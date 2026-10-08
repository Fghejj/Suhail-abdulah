package com.hari.androidtvremote.androidLib.remote;

import android.Manifest;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

import androidx.annotation.RequiresPermission;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Captures microphone audio as 16-bit PCM, mono, 8 kHz and streams
 * it in ~20 KB chunks — matching the format expected by the Android TV
 * RemoteVoicePayload protocol.
 *
 * Includes adaptive-noise-floor Voice Activity Detection (VAD) to automatically
 * stop recording when the user finishes speaking or if initial silence times out.
 */
public class VoiceManager {

    private static final String TAG = "VoiceManager";

    // Audio format required by the Android TV voice protocol
    public static final int SAMPLE_RATE    = 8000;              // 8 kHz
    public static final int CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO;
    public static final int AUDIO_FORMAT   = AudioFormat.ENCODING_PCM_16BIT;

    // Target payload batch size for Android TV Remote protocol (~20 KB)
    private static final int CHUNK_SIZE_BYTES = 20 * 1024;

    // Sub-chunk read size for fine-grained VAD (~128ms per read)
    private static final int SUB_CHUNK_SIZE_BYTES = 2048;

    // ── VAD Calibration & Thresholds ──────────────────────────────────────────
    private static final int CALIBRATION_FRAMES = 5;
    private static final double NOISE_FLOOR_MIN_DB = -60.0;
    private static final double NOISE_FLOOR_MAX_DB = -20.0;
    private static final double NOISE_FLOOR_ADAPT_RATE = 0.05;

    private static final double SPEECH_START_MARGIN_DB = 5.0;
    private static final double SPEECH_CONTINUE_MARGIN_DB = 3.0;
    private static final int SPEECH_CONFIRM_FRAMES = 2;

    private static final long SILENCE_HANGOVER_MS = 1500L;
    private static final long INITIAL_SILENCE_TIMEOUT_MS = 5000L;
    private static final long MAX_RECORDING_DURATION_MS = 12000L;

    private final ChunkCallback mChunkCallback;
    private final AutoStopCallback mAutoStopCallback;
    private final AtomicBoolean mRecording = new AtomicBoolean(false);

    private AudioRecord mAudioRecord;
    private Thread mRecordThread;

    public VoiceManager(ChunkCallback chunkCallback) {
        this(chunkCallback, null);
    }

    public VoiceManager(ChunkCallback chunkCallback, AutoStopCallback autoStopCallback) {
        this.mChunkCallback = chunkCallback;
        this.mAutoStopCallback = autoStopCallback;
    }

    @RequiresPermission(Manifest.permission.RECORD_AUDIO)
    public boolean startRecording() {
        if (mRecording.get()) {
            Log.w(TAG, "startRecording called while already recording");
            return false;
        }

        int minBufSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT);
        if (minBufSize == AudioRecord.ERROR || minBufSize == AudioRecord.ERROR_BAD_VALUE) {
            Log.e(TAG, "AudioRecord.getMinBufferSize() failed: " + minBufSize);
            return false;
        }

        int bufferSize = Math.max(minBufSize, CHUNK_SIZE_BYTES);

        mAudioRecord = new AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
        );

        if (mAudioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord failed to initialise");
            mAudioRecord.release();
            mAudioRecord = null;
            return false;
        }

        mRecording.set(true);
        mAudioRecord.startRecording();

        mRecordThread = new Thread(this::recordLoop, "VoiceManager-Record");
        mRecordThread.start();

        Log.i(TAG, "Recording started (8 kHz, mono, PCM-16, VAD active)");
        return true;
    }

    public void stopRecording() {
        if (!mRecording.compareAndSet(true, false)) {
            return;
        }

        if (mAudioRecord != null) {
            try {
                mAudioRecord.stop();
            } catch (IllegalStateException ignored) {}
            mAudioRecord.release();
            mAudioRecord = null;
        }

        if (mRecordThread != null) {
            mRecordThread.interrupt();
            mRecordThread = null;
        }

        Log.i(TAG, "Recording stopped");
    }

    public boolean isRecording() {
        return mRecording.get();
    }

    // ── internal ──────────────────────────────────────────────────────────────

    private void recordLoop() {
        byte[] subBuffer = new byte[SUB_CHUNK_SIZE_BYTES];
        ByteArrayOutputStream payloadBuffer = new ByteArrayOutputStream(CHUNK_SIZE_BYTES);

        List<Double> calibrationSamples = new ArrayList<>(CALIBRATION_FRAMES);
        double noiseFloorDb = -50.0;
        boolean isCalibrated = false;

        boolean speechConfirmed = false;
        int loudFrameStreak = 0;
        long silenceStartTime = 0L;
        long recordingStart = System.currentTimeMillis();

        while (mRecording.get() && !Thread.currentThread().isInterrupted()) {
            int bytesRead = mAudioRecord.read(subBuffer, 0, subBuffer.length);

            if (bytesRead <= 0) {
                if (bytesRead == AudioRecord.ERROR_INVALID_OPERATION
                        || bytesRead == AudioRecord.ERROR_BAD_VALUE) {
                    Log.e(TAG, "AudioRecord.read() error: " + bytesRead);
                    break;
                }
                continue;
            }

            // Batch payload for Android TV Remote protocol
            payloadBuffer.write(subBuffer, 0, bytesRead);
            if (payloadBuffer.size() >= CHUNK_SIZE_BYTES) {
                byte[] chunk = payloadBuffer.toByteArray();
                payloadBuffer.reset();
                if (mChunkCallback != null) {
                    mChunkCallback.onChunk(chunk);
                }
            }

            // VAD evaluation
            double db = calculateDb(subBuffer, bytesRead);
            long now = System.currentTimeMillis();

            // Phase 0: Calibrate noise floor
            if (!isCalibrated) {
                calibrationSamples.add(db);
                if (calibrationSamples.size() >= CALIBRATION_FRAMES) {
                    Collections.sort(calibrationSamples);
                    noiseFloorDb = Math.max(NOISE_FLOOR_MIN_DB, Math.min(NOISE_FLOOR_MAX_DB, calibrationSamples.get(calibrationSamples.size() / 2)));
                    isCalibrated = true;
                    Log.i(TAG, String.format("VAD: Noise floor calibrated at %.1f dB", noiseFloorDb));
                }
                continue;
            }

            double startThreshold = noiseFloorDb + SPEECH_START_MARGIN_DB;
            double continueThreshold = noiseFloorDb + SPEECH_CONTINUE_MARGIN_DB;

            if (!speechConfirmed) {
                // Phase 1: Waiting for speech start
                if (db > startThreshold) {
                    loudFrameStreak++;
                    if (loudFrameStreak >= SPEECH_CONFIRM_FRAMES) {
                        speechConfirmed = true;
                        silenceStartTime = 0L;
                        Log.i(TAG, String.format("VAD: Speech STARTED (%.1f dB vs noise floor %.1f dB)", db, noiseFloorDb));
                    }
                } else {
                    loudFrameStreak = 0;
                    noiseFloorDb = adaptNoiseFloor(noiseFloorDb, db);
                }

                if (!speechConfirmed && (now - recordingStart >= INITIAL_SILENCE_TIMEOUT_MS)) {
                    Log.w(TAG, "VAD: No speech detected in " + INITIAL_SILENCE_TIMEOUT_MS + "ms — auto-stopping.");
                    break;
                }
            } else {
                // Phase 2: Speech active, waiting for end of speech
                if (db > continueThreshold) {
                    silenceStartTime = 0L;
                } else {
                    if (silenceStartTime == 0L) {
                        silenceStartTime = now;
                    }
                    long silenceDuration = now - silenceStartTime;
                    if (silenceDuration >= SILENCE_HANGOVER_MS) {
                        Log.i(TAG, "VAD: End of speech detected (" + silenceDuration + "ms silence) — auto-stopping.");
                        break;
                    }
                }

                if (now - recordingStart >= MAX_RECORDING_DURATION_MS) {
                    Log.i(TAG, "VAD: Max recording duration (" + MAX_RECORDING_DURATION_MS + "ms) reached — auto-stopping.");
                    break;
                }
            }
        }

        // Flush remaining payload bytes
        if (payloadBuffer.size() > 0 && mChunkCallback != null) {
            mChunkCallback.onChunk(payloadBuffer.toByteArray());
            payloadBuffer.reset();
        }

        Log.i(TAG, "Record loop exited");

        // Trigger auto-stop callback if stopped by VAD
        if (mRecording.compareAndSet(true, false)) {
            if (mAudioRecord != null) {
                try {
                    mAudioRecord.stop();
                } catch (IllegalStateException ignored) {}
                mAudioRecord.release();
                mAudioRecord = null;
            }
            if (mAutoStopCallback != null) {
                mAutoStopCallback.onAutoStop();
            }
        }
    }

    private double adaptNoiseFloor(double current, double sampleDb) {
        double updated = current + NOISE_FLOOR_ADAPT_RATE * (sampleDb - current);
        return Math.max(NOISE_FLOOR_MIN_DB, Math.min(NOISE_FLOOR_MAX_DB, updated));
    }

    private double calculateDb(byte[] buffer, int length) {
        if (length < 2) return -100.0;
        double sum = 0.0;
        int samples = 0;
        int i = 0;
        while (i + 1 < length) {
            int sample = (buffer[i] & 0xFF) | (buffer[i + 1] << 8);
            short signed = (short) sample;
            sum += signed * (double) signed;
            samples++;
            i += 2;
        }
        if (samples == 0) return -100.0;
        double rms = Math.sqrt(sum / samples);
        if (rms <= 0.0) return -100.0;
        return 20.0 * Math.log10(rms / Short.MAX_VALUE);
    }

    // ── callback interfaces ───────────────────────────────────────────────────

    public interface ChunkCallback {
        void onChunk(byte[] pcmChunk);
    }

    public interface AutoStopCallback {
        void onAutoStop();
    }
}