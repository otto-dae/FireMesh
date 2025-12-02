#ifndef SYNC_MANAGER_H
#define SYNC_MANAGER_H

#include <painlessMesh.h>
#include <ArduinoJson.h>
#include <deque>

// Estructura de datos según protocolo
struct DataPacket {
    unsigned long long timestamp;
    int humo;
    int fuego;
};

class SyncManager {
private:
    painlessMesh* mesh;
    double timeOffset;
    bool isSynchronized;
    uint32_t rootNodeId;
    std::deque<DataPacket>* offlineBuffer;
    int maxBufferSize;

public:
    SyncManager(painlessMesh* meshInstance, int maxBuffer = 20);
    
    // Getters
    double getTimeOffset();
    bool getSyncStatus();
    uint32_t getRootId();
    unsigned long long getNetworkTime();
    
    // Setters
    void setTimeOffset(double offset);
    void setSyncStatus(bool status);
    void setRootId(uint32_t id);
    
    // Buffer management
    void addToBuffer(DataPacket data);
    bool hasBufferedData();
    void flushBuffer(void (*sendCallback)(DataPacket, String));
    
    // Mesh helpers
    String createDataJSON(DataPacket data, String tipo, uint32_t nodeId);
    void handleSyncRequest(uint32_t from);
    void handleSyncResponse(JsonDocument& doc);
};

#endif