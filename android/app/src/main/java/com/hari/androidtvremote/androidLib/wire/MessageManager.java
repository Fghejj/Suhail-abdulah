package com.hari.androidtvremote.androidLib.wire;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public abstract class MessageManager {

    private final Logger logger = LoggerFactory.getLogger(MessageManager.class);

    private static int getVarintSize(int value) {
        int size = 0;
        do {
            size++;
            value >>>= 7;
        } while (value != 0);
        return size;
    }

    /**
     * Encode a length as a varint (little-endian, 7 bits per byte, MSB=1 means "more bytes follow").
     * This matches the Android TV Remote Protocol framing spec.
     *
     * Single-byte length was the root cause of the voice "Connection reset" bug:
     * a voice payload is ~649 bytes. (byte)649 wraps to 137, so the TV received a
     * 137-byte frame followed by 512 bytes of garbage → connection reset.
     */
    private static int writeVarint(byte[] buf, int offset, int value) {
        while (true) {
            if ((value & ~0x7F) == 0) {
                // Last (or only) byte — MSB=0
                buf[offset++] = (byte) value;
                return offset;
            } else {
                // More bytes to come — write 7 bits with MSB=1
                buf[offset++] = (byte) ((value & 0x7F) | 0x80);
                value >>>= 7;
            }
        }
    }

    public byte[] addLengthAndCreate(byte[] message) {
        int length = message.length;
        if (logger.isDebugEnabled()) {
            logger.debug(String.valueOf(length));
        }
        int varintSize = getVarintSize(length);
        byte[] buf = new byte[varintSize + length];
        writeVarint(buf, 0, length);
        System.arraycopy(message, 0, buf, varintSize, length);
        return buf;
    }
}
