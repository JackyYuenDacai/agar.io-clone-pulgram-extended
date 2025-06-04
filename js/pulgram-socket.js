/**
 * PulgramSocket - A host-election socket adapter for Pulgram Bridge
 * 
 * This adapter simulates socket.io-like functionality with host-client constraints:
 * 1. Only the host can broadcast to all clients
 * 2. Clients can only send to and receive from the host
 * 3. Providing emit/on interface similar to sockets
 */
const pulgram = window.pulgram
class PulgramSocket {
    constructor(namespace = 'default', initialHandlers = {}) {
        this.namespace = namespace;
        this.isHost = false;
        this.participants = new Map(); // userId -> timestamp
        this.eventListeners = {};
        this.hostId = null;
        this.hostElectionInterval = null;
        this.hostElectionTimeout = 5000; // 5 seconds
        this.lastPing = Date.now();
        this.discoveryTimeout = null;
        this.messageQueue = []; // Queue for messages when no host is available
        // Register initial event handlers
        for (const [event, handler] of Object.entries(initialHandlers)) {
            this.on(event, handler);
        }
        // Initialize
        this._setupMessageListener();
    
    }

    /**
     * Emit an event based on role:
     * - Host: Broadcasts to all clients
     * - Client: Sends only to host
     * 
     * @param {string} event - Event name
     * @param {any} data - Data to send
     * @param {string} targetId - Optional specific target (host use only)
     */
    emit(event, data, targetId = null) {
        // System events are always allowed
        const isSystemEvent = event.startsWith('_');
        
        // For non-system events, enforce host-client communication rules
        if (!isSystemEvent) {
            if (!this.isHost && !this.hostId) {
                // No host available, queue the message
                this.messageQueue.push({event, data});
                console.log(`No host available. Queued message: ${event}`);
                return;
            }
            
            if (!this.isHost && targetId) {
                console.warn('Clients can only send messages to host. Ignoring targetId parameter.');
                targetId = null; // Clients can only send to host
            }
        }

        const message = {
            type: 'socket',
            namespace: this.namespace,
            event: event,
            data: data,
            from: pulgram.getUserId(),
            to: this.isHost ? targetId : this.hostId, // Client → Host, Host → All or specific client
            timestamp: Date.now()
        };

 
        // Send via Pulgram
        
        pulgram.sendMessage(JSON.stringify(message));
        // Process immediately on host for system events or when targeting self
        if (isSystemEvent || this.isHost) {
            console.log(`Processing system event immediately: ${event}`, data);
            this._processMessage(message);
        } 
    }

    /**
     * Broadcast an event to all clients (host only)
     * @param {string} event - Event name
     * @param {any} data - Data to send
     */
    broadcast(event, data) {
        if (!this.isHost) {
            console.warn('Only the host can broadcast messages');
            return;
        }
        
        this.emit(event, data);
    }

    /**
     * Send a direct message to a specific client (host only)
     * @param {string} event - Event name
     * @param {any} data - Data to send
     * @param {string} clientId - Target client ID
     */
    sendTo(event, data, clientId) {
        if (!this.isHost) {
            console.warn('Only the host can send direct messages');
            return;
        }
        
        this.emit(event, data, clientId);
    }

    /**
     * Register an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    /**
     * Remove an event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (!this.eventListeners[event]) return;
        
        if (callback) {
            this.eventListeners[event] = this.eventListeners[event]
                .filter(cb => cb !== callback);
        } else {
            delete this.eventListeners[event];
        }
    }

    /**
     * Get current connection status
     * @returns {Object} Status object
     */
    status() {
        return {
            isHost: this.isHost,
            hostId: this.hostId,
            participants: Array.from(this.participants.keys()),
            connected: this.hostId !== null,
            namespace: this.namespace
        };
    }

    /**
     * Process queued messages
     * @private
     */
    _processMessageQueue() {
        if (this.messageQueue.length > 0 && this.hostId) {
            console.log(`Processing ${this.messageQueue.length} queued messages`);
            
            this.messageQueue.forEach(msg => {
                this.emit(msg.event, msg.data);
            });
            
            this.messageQueue = [];
        }
    }

    /**
     * Setup Pulgram message listener
     * @private
     */
    _setupMessageListener() {
        pulgram.setOnMessageReceivedListener(async  (message) => {

            try {
                const socketMessage = JSON.parse(message.content);
                if (socketMessage.type === 'socket' && 
                    socketMessage.namespace === this.namespace) {
                    console.log(`Received socket message: ${socketMessage.event}`, socketMessage.data);
                    this._handleSocketMessage(socketMessage);
                }
            } catch (e) {
                console.error('Error processing socket message:', e);
            }
        });
    }

    /**
     * Join the session and participate in host election
     * @private
     */
    _joinSession() {
        const myId = pulgram.getUserId();
        this.participants.set(myId, Date.now());
        
        // First, announce our presence and request host information
        this.emit('_join', { userId: myId });
        this.emit('_request_host', { userId: myId });
        
        // IMPORTANT CHANGE: Wait for existing host responses before running election
        this.discoveryTimeout = setTimeout(() => { // Store in the class property
            // Only start the host election process if we haven't found a host yet
            if (!this.hostId) {
                console.log("No host response received, starting election process");
                this._checkHostStatus();
                
                // Set up recurring host checks
                if (!this.hostElectionInterval) {
                    this.hostElectionInterval = setInterval(() => {
                        this._checkHostStatus();
                    }, 3000);
                }
            }
        }, 2000); // Increase to 2 seconds for more reliable host discovery
    
        
        // Fire a connected event once we have a host (either we became host or found one)
        const checkConnection = setInterval(() => {
            if (this.hostId) {
                clearInterval(checkConnection);
                this._triggerEvent('connected', {
                    hostId: this.hostId,
                    isHost: this.isHost
                });
            } else {
                // If still no host after a while, try requesting again
                this.emit('_request_host', { userId: myId });
            }
        }, 500); // Check frequently until connected
    }
    connect() {
        this._joinSession();
 
    }
    
    /**
     * Check host status and initiate election if needed
     * @private
     */
    _checkHostStatus() {
        const now = Date.now();
        
        // Remove stale participants (inactive for 10 seconds)
        for (const [userId, timestamp] of this.participants.entries()) {
            if (now - timestamp > 10000) {
                this.participants.delete(userId);
                this._triggerEvent('disconnect', { userId });
            }
        }
        
        // Initiate election ONLY if:
        // 1. No host exists yet
        // 2. Current host is gone from participants list
        // 3. No ping received in a long time (host is unresponsive)
        const needsElection = !this.hostId || 
                        (this.hostId && !this.participants.has(this.hostId)) ||
                        (now - this.lastPing > this.hostElectionTimeout);
                        
        if (needsElection) {
            this._electHost();
        }
        
        // Send ping to maintain presence (less frequently)
        if (now - this.lastPing > 2000) {  // Only ping every 2 seconds
            this.emit('_ping', { userId: pulgram.getUserId() });
        }
    }    /**
     * Elect a host based on connected participants
     * @private
     */
    _electHost() {
        // Add self to participants if not present
        const myId = pulgram.getUserId();
        this.participants.set(myId, Date.now());
        
        // Get all active participants
        const activeParticipants = Array.from(this.participants.keys());
        
        // Previous host status
        const wasHost = this.isHost;
        const previousHostId = this.hostId;
        
        if (activeParticipants.length === 0) {
            // If no active participants, make self host
            this.isHost = true;
            this.hostId = myId;
        } else {
            // Deterministic host selection (use the lowest userId as host)
            const newHost = activeParticipants.sort()[0];
            this.hostId = newHost;
            this.isHost = (newHost === myId);
        }
        
        // Update last ping time
        this.lastPing = Date.now();
        
        // Only send host election messages and trigger events if the host actually changed
        if (this.hostId !== previousHostId) {
            console.log(`Host changed from ${previousHostId || 'none'} to ${this.hostId}`);
            
            if (this.isHost) {
                // Announce host election result only if I'm the new host
                this.emit('_host_elected', { 
                    hostId: this.hostId, 
                    participants: Array.from(this.participants.keys()) 
                });
                
                // Trigger host event
                this._triggerEvent('host_changed', { 
                    hostId: this.hostId,
                    isMe: true,
                    previousHostId: previousHostId
                });
                
                // Process any queued messages now that we're host
                this._processMessageQueue();
            }
        } else {
            // Just log without sending messages if host is the same
            console.log(`Host status unchanged: ${this.hostId} (self is host: ${this.isHost})`);
        }
    }

    /**
     * Handle incoming socket messages
     * @param {Object} message - Socket message
     * @private
     */
    _handleSocketMessage(message) {
        // Update participant's last active time
        this.participants.set(message.from, Date.now());
        
        // Process system messages
        if (message.event.startsWith('_')) {            // System messages are handled regardless of sender
            if (message.event === '_host_elected') {
                this.hostId = message.data.hostId;
                this.isHost = (pulgram.getUserId() === this.hostId);
                
                // Update participants from host's list
                for (const userId of message.data.participants) {
                    if (!this.participants.has(userId)) {
                        this.participants.set(userId, Date.now());
                    }
                }
                
                this._triggerEvent('host_changed', { 
                    hostId: this.hostId,
                    isMe: this.isHost,
                    previousHostId: this.hostId !== message.data.hostId ? this.hostId : null
                });
                
 
                
                return;
            } else if (message.event === '_ping') {
                this.lastPing = Date.now();
                return;
            } else if (message.event === '_join') {
                this._triggerEvent('user_joined', { userId: message.from });
                return;
            } else if (message.event === '_leave') {
                this.participants.delete(message.from);
                this._triggerEvent('user_left', { userId: message.from });
                return;
            } else if (message.event === '_request_host') {
                // If I'm the host, respond to host requests
                if (this.isHost) {
                    console.log(`Responding to host request from ${message.from}`);
                    this.emit('_host_info', { 
                        hostId: this.hostId,
                        participants: Array.from(this.participants.keys())
                    }); // Direct reply to the requester
                }
                return;
            }
                else if (message.event === '_host_info') {
                    // Update host info when received
                    this.hostId = message.data.hostId;
                    this.isHost = (pulgram.getUserId() === this.hostId);
                    
                    console.log('Received host info:', message.data);
                    
                    // Clear the discovery timeout to prevent automatic host election
                    if (this.discoveryTimeout) {
                        console.log('Clearing discovery timeout, host info received');
                        clearTimeout(this.discoveryTimeout);
                        this.discoveryTimeout = null;
                    }
                    // Update participants from host's list
                    for (const userId of message.data.participants) {
                        if (!this.participants.has(userId)) {
                            this.participants.set(userId, Date.now());
                        }
                    }
                    
                    // Process any queued messages now that we have a host
                    if (!this.isHost) {
                        this._processMessageQueue();
                    }
                    
                    // Trigger host_changed event for non-hosts too
                    this._triggerEvent('host_changed', { 
                        hostId: this.hostId,
                        isMe: this.isHost,
                        previousHostId: null
                    });
                    
                    return;
                }
        } else {
            // For regular messages, apply communication constraints:
            
            const myId = pulgram.getUserId();
            
            // 1. If I'm not the host, only accept messages from the host
            if (!this.isHost && message.from !== this.hostId) {
                console.log(`Ignoring message from non-host user: ${message.from}`);
                return;
            }
            
            // 2. If I'm the host, accept messages from everyone
            
            // 3. If message has a specific recipient, only process if it's for me
            if (message.to && message.to !== myId) {
                return;
            }
        }
        
        // Process the message
        this._processMessage(message);
    }

    /**
     * Process a message by triggering the appropriate event
     * @param {Object} message - Socket message
     * @private
     */
    _processMessage(message) {
        this._triggerEvent(message.event, message.data);
    }

    /**
     * Trigger an event for all registered listeners
     * @param {string} event - Event name
     * @param {any} data - Event data
     * @private
     */
    _triggerEvent(event, data) {
        console.log(`Triggering event: ${event}`, data);
        if (!this.eventListeners[event]) return;
        
        for (const callback of this.eventListeners[event]) {
            try {
                callback(data);
            } catch (e) {
                console.error(`Error in ${event} handler:`, e);
            }
        }
    }

    /**
     * Disconnect from the session
     */
    disconnect() {
        clearInterval(this.hostElectionInterval);
        this.emit('_leave', { userId: pulgram.getUserId() });
        this.hostElectionInterval = null;
        this.isHost = false;
        this.participants.clear();
        this.eventListeners = {};
        this.messageQueue = [];
    }
}

// Export to global scope
export default PulgramSocket;
window.PulgramSocket = PulgramSocket;