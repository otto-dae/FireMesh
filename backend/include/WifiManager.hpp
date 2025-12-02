
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <WiFi.h>

class WiFiManager {
private:
    const char* ssid;
    const char* password;
    int maxAttempts;

public:
    WiFiManager(const char* ssid, const char* password, int maxAttempts = 20);
    bool connect();
    bool isConnected();
    String getIP();
    void disconnect();
};

#endif