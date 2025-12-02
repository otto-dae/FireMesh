#include "WifiManager.hpp"

WiFiManager::WiFiManager(const char* ssid, const char* password, int maxAttempts) 
    : ssid(ssid), password(password), maxAttempts(maxAttempts) {}

bool WiFiManager::connect() {
    Serial.printf("\n[WiFi] Conectando a %s...\n", ssid);
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < maxAttempts) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WiFi] Conectado. IP: %s\n", WiFi.localIP().toString().c_str());
        return true;
    } else {
        Serial.println("\n[WiFi] Fallo de conexión");
        return false;
    }
}

bool WiFiManager::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

String WiFiManager::getIP() {
    return WiFi.localIP().toString();
}

void WiFiManager::disconnect() {
    WiFi.disconnect();
    Serial.println("[WiFi] Desconectado");
}