package com.hari.androidtvremote.androidLib.wire;

import java.io.IOException;
import java.io.InputStream;

public abstract class PacketParser extends Thread {
    private final InputStream mInputStream;

    private volatile boolean isAbort = false;

    public PacketParser(InputStream inputStream) {
        mInputStream = inputStream;
    }

    /**
     * Read a varint-encoded length from the stream.
     * Returns the decoded length, or -1 if the stream ended.
     * Matches the varint encoding in MessageManager.addLengthAndCreate().
     */
    private int readVarint() throws IOException {
        int result = 0;
        int shift = 0;
        while (true) {
            int b = mInputStream.read();
            if (b < 0) return -1;  // Stream closed
            result |= (b & 0x7F) << shift;
            if ((b & 0x80) == 0) return result;  // MSB=0 → last byte
            shift += 7;
            if (shift >= 35) return -1;  // Malformed varint (>5 bytes)
        }
    }

    @Override
    public void run() {
        boolean streamClosed = false;
        while (!isAbort) {
            try {
                int available = readVarint();

                if (available < 0) {
                    // Stream closed
                    isAbort = true;
                    streamClosed = true;
                    break;
                }
                if (available == 0) continue;

                byte[] buf = new byte[available];
                int bytesRead = 0;
                while (bytesRead < available) {
                    int read = mInputStream.read(buf, bytesRead, available - bytesRead);
                    if (read < 0) {
                        isAbort = true;
                        streamClosed = true;
                        break;
                    }
                    bytesRead += read;
                }

                if (!isAbort) {
                    messageBufferReceived(buf);
                }
            } catch (java.net.SocketTimeoutException e) {
                // Read timed out while waiting for next packet — socket is still alive, continue waiting
                continue;
            } catch (IOException e) {
                if (!isAbort) {
                    // Unexpected IOException (not caused by our own abort close)
                    e.printStackTrace();
                    streamClosed = true;
                }
                isAbort = true;
            }
        }
        if (streamClosed) {
            onStreamClosed();
        }
    }

    /**
     * Abort the parser.
     *
     * Sets the abort flag AND closes the InputStream so any thread that is
     * currently blocked inside a native read() call (readVarint or the
     * byte-buffer read loop) receives an IOException immediately. Without
     * this close, the thread would remain blocked until the OS socket idle
     * timeout fires (typically 75–120 s), keeping the connection in a
     * zombie state.
     */
    public void abort() {
        isAbort = true;
        try {
            mInputStream.close();
        } catch (IOException ignored) {
            // Ignore — we are tearing down the session anyway
        }
    }

    protected void onStreamClosed() {
        // Subclasses can override to notify listeners
    }

    public abstract void messageBufferReceived(byte[] buf);
}
