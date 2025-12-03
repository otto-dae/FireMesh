#include "SyncManager.hpp"

SyncManager::SyncManager(painlessMesh* meshInstance, int maxBuffer)
    : mesh(meshInstance), timeOffset(0.0), isSynchronized(false), 
      rootNodeId(0), maxBufferSize(maxBuffer) {
    offlineBuffer = new std::deque<DataPacket>();
}

double SyncManager::getTimeOffset() {
    return timeOffset;
}

bool SyncManager::getSyncStatus() {
    return isSynchronized;
}

uint32_t SyncManager::getRootId() {
    return rootNodeId;
}

unsigned long long SyncManager::getNetworkTime() {
    return (unsigned long long)millis() + (long long)timeOffset;
}

void SyncManager::setTimeOffset(double offset) {
    timeOffset = offset;
}

void SyncManager::setSyncStatus(bool status) {
    isSynchronized = status;
}

void SyncManager::setRootId(uint32_t id) {
    rootNodeId = id;
    Serial.printf("[Sync] Root ID establecido: %u\n", id);
}

void SyncManager::addToBuffer(DataPacket data) {
    offlineBuffer->push_back(data);
    
    if (offlineBuffer->size() > maxBufferSize) {
        offlineBuffer->pop_front();
        Serial.println("[Buffer] Memoria llena. Borrando dato más antiguo.");
    }
    
    Serial.printf("[Buffer] Datos guardados. Buffer: %d/%d\n", 
                  offlineBuffer->size(), maxBufferSize);
}

bool SyncManager::hasBufferedData() {
    return !offlineBuffer->empty();
}

void SyncManager::flushBuffer(void (*sendCallback)(DataPacket, String)) {
    if (offlineBuffer->empty()) return;
    
    Serial.println("\nRECONEXIÓN: Vaciando memoria (Burst)...");
    while (!offlineBuffer->empty()) {
        DataPacket saved = offlineBuffer->front();
        sendCallback(saved, "DATA_HIST");
        
        Serial.printf(">> RECUPERADO: humo=%d, fuego=%d (TS: %llu)\n", 
                     saved.humo, saved.fuego, saved.timestamp);
        offlineBuffer->pop_front();
        delay(50);
    }
    Serial.println("Memoria vaciada.\n");
}

String SyncManager::createDataJSON(DataPacket data, String tipo, uint32_t nodeId) {
    StaticJsonDocument<256> doc;
    doc["type"] = tipo;
    doc["src"] = nodeId;
    
    JsonObject body = doc.createNestedObject("body");
    body["ts"] = data.timestamp;
    body["humo"] = data.humo;
    body["fuego"] = data.fuego;
    
    String output;
    serializeJson(doc, output);
    return output;
}

void SyncManager::handleSyncRequest(uint32_t from) {
    StaticJsonDocument<256> res;
    res["type"] = "TIME";
    res["src"] = mesh->getNodeId();

    JsonObject body = res.createNestedObject("body");
    body["T2"] = (unsigned long long)millis();
    body["T3"] = (unsigned long long)millis();

    String resMsg;
    serializeJson(res, resMsg);

    // painlessMesh hace routing automático multi-hop
    mesh->sendSingle(from, resMsg);

    Serial.printf("[Sync] Enviando T2,T3 hacia nodo %u (auto-multihop)\n", from);
}


void SyncManager::handleSyncResponse(JsonDocument& doc) {
    if (doc["body"].isNull()) {
        Serial.println("[Sync] Error: 'body' no presente en TIME");
        return;
    }
    
    unsigned long long T2 = doc["body"]["T2"];
    unsigned long long T3 = doc["body"]["T3"];
    unsigned long long T1 = millis();
    unsigned long long T4 = millis();
    
    double offset = ((double)(T2 - T1) + (double)(T3 - T4)) / 2.0;
    timeOffset = offset;
    isSynchronized = true;
    Serial.printf("[NTP] Sincronizado. Offset: %.2f ms\n", timeOffset);
}
