package com.starsat.sleepcompanion;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.math.BigInteger;
import java.net.ServerSocket;
import java.net.Socket;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.cert.Certificate;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLServerSocket;
import javax.net.ssl.SSLSocket;
import javax.security.auth.x500.X500Principal;

final class SleepCommandServer {
    static final String SERVICE_TYPE = "_starsat-sleep._tcp.";
    private static final String ALIAS = "starsat-companion-tls";
    private final Context context;
    private final SharedPreferences prefs;
    private final SleepExecutor executor;
    private final ExecutorService workers = Executors.newCachedThreadPool();
    private volatile boolean running;
    private SSLServerSocket serverSocket;
    private NsdManager nsd;
    private NsdManager.RegistrationListener registrationListener;
    private String pin;

    SleepCommandServer(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences("companion", Context.MODE_PRIVATE);
        this.executor = new SleepExecutor(this.context);
    }

    String getPin() { return pin; }
    int getPort() { return serverSocket == null ? 0 : serverSocket.getLocalPort(); }

    void start() throws Exception {
        if (running) return;
        ensureIdentity();
        SSLContext tls = SSLContext.getInstance("TLS");
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        KeyManagerFactory kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        kmf.init(keyStore, null);
        tls.init(kmf.getKeyManagers(), null, null);
        serverSocket = (SSLServerSocket) tls.getServerSocketFactory().createServerSocket(0);
        serverSocket.setEnabledProtocols(new String[]{"TLSv1.2", "TLSv1.3"});
        pin = String.format(Locale.US, "%06d", (int) (Math.random() * 1_000_000));
        running = true;
        registerNsd();
        workers.execute(() -> {
            while (running) {
                try {
                    final Socket client = serverSocket.accept();
                    workers.execute(() -> handle(client));
                } catch (Exception ignored) { if (running) ignored.printStackTrace(); }
            }
        });
    }

    void stop() {
        running = false;
        if (nsd != null && registrationListener != null) { try { nsd.unregisterService(registrationListener); } catch (Exception ignored) { } }
        try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignored) { }
        workers.shutdownNow();
    }

    private void handle(Socket raw) {
        try (SSLSocket socket = (SSLSocket) raw) {
            socket.setSoTimeout(5000);
            socket.startHandshake();
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            PrintWriter out = new PrintWriter(socket.getOutputStream(), true);
            String line = in.readLine();
            if (line == null) return;
            String[] parts = line.trim().split(" ", 3);
            String command = parts[0];
            if ("PAIR".equals(command) && parts.length >= 2 && pin.equals(parts[1])) {
                String token = UUID.randomUUID().toString();
                prefs.edit().putString("token", token).apply();
                out.println(new JSONObject().put("status", "PAIRED").put("token", token).put("fingerprint", fingerprint()).toString());
            } else if ("CAPABILITY".equals(command) && validToken(parts)) {
                out.println(executor.capability().toString());
            } else if ("SLEEP".equals(command) && validToken(parts)) {
                out.println(executor.sleep().toString());
            } else {
                out.println(new JSONObject().put("status", "UNAUTHORIZED").put("reason", "Pairing or authentication failed").toString());
            }
        } catch (Exception ignored) { }
    }

    private boolean validToken(String[] parts) { return parts.length >= 2 && parts[1].equals(prefs.getString("token", "")); }

    private void ensureIdentity() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(ALIAS)) return;
        java.security.KeyPairGenerator generator = java.security.KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_DECRYPT)
                .setKeySize(2048).setDigests(KeyProperties.DIGEST_SHA256).setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
                .setCertificateSubject(new X500Principal("CN=StarSat Sleep Companion"))
                .setCertificateSerialNumber(BigInteger.ONE)
                .setCertificateNotBefore(new java.util.Date(System.currentTimeMillis() - 60_000L))
                .setCertificateNotAfter(new java.util.Date(System.currentTimeMillis() + 10L * 365 * 24 * 60 * 60 * 1000))
                .build();
        generator.initialize(spec); generator.generateKeyPair();
    }

    private String fingerprint() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        Certificate cert = ks.getCertificate(ALIAS);
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(cert.getEncoded());
        StringBuilder out = new StringBuilder(); for (byte b : digest) out.append(String.format(Locale.US, "%02X", b)); return out.toString();
    }

    private void registerNsd() {
        nsd = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        NsdServiceInfo info = new NsdServiceInfo(); info.setServiceName("StarSat Sleep Companion"); info.setServiceType(SERVICE_TYPE); info.setPort(getPort());
        registrationListener = new NsdManager.RegistrationListener() {
            public void onServiceRegistered(NsdServiceInfo serviceInfo) { }
            public void onRegistrationFailed(NsdServiceInfo serviceInfo, int errorCode) { }
            public void onServiceUnregistered(NsdServiceInfo serviceInfo) { }
            public void onUnregistrationFailed(NsdServiceInfo serviceInfo, int errorCode) { }
        };
        nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, registrationListener);
    }
}
