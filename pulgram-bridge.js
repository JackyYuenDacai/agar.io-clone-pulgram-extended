if (!window.pulgram) {
    // Define message types and structures
    const MessageType = {
        TEXT: 'TEXT',
        IMAGE: 'IMAGE',
        AUDIO: 'AUDIO',
        VIDEO: 'VIDEO',
        FILE: 'FILE',
        LOCATION: 'LOCATION',
        GAME_MOVE: 'GAME_MOVE'
    };
    
    const MessageStatus = {
        SENDING: 'SENDING',
        SENT: 'SENT',
        DELIVERED: 'DELIVERED',
        READ: 'READ',
        FAILED: 'FAILED'
    };
    
    const ReceiverType = {
        USER: 'USER',
        GROUP: 'GROUP'
    };
    
    // User class definition
    class User {
        constructor(data = {}) {
            this.userId = data.userId || '';
            this.username = data.username || '';
            this.nickname = data.nickname || null;
            this.email = data.email || null;
            this.phoneNumber = data.phoneNumber || null;
            this.passwordHash = data.passwordHash || null;
            this.avatarUrl = data.avatarUrl || null;
            this.status = data.status || null;
            this.verified = data.verified || false;
            this.registrationSource = data.registrationSource || null;
            this.hasPassword = data.hasPassword || false;
            this.createdAt = data.createdAt || null;
            this.updatedAt = data.updatedAt || null;
            this.lastLoginAt = data.lastLoginAt || null;
            this.bio = data.bio || null;
            this.preferenceJson = data.preferenceJson || null;
        }
    }
    
    // Main pulgram object
    window.pulgram = {
        // Message and User structures
        MessageType,
        MessageStatus,
        ReceiverType,
        User,
        
        // Helper for creating structured messages
        createMessage: function(content, type = MessageType.TEXT, receiverType = ReceiverType.USER) {
            return {
                messageId: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                sessionId: '',
                senderId: this.getUserId(),
                senderName: '', // Will be filled by the app
                senderAvatar: null,
                receiverId: '',
                receiverType: receiverType,
                content: content,
                type: type,
                timestamp: Date.now(),
                status: MessageStatus.SENDING
            };
        },
        
        // Helper for parsing user objects
        parseUser: function(userJson) {
            if (typeof userJson === 'string') {
                try {
                    userJson = JSON.parse(userJson);
                } catch (e) {
                    console.error('Error parsing user JSON:', e);
                    return null;
                }
            }
            return new User(userJson);
        },
        
        messageListeners: [],
        
        sendMessage: function(message) {
            if (typeof message === 'object') {
                message = JSON.stringify(message);
            }
            console.log('SMending:', message);
            AndroidBridge.sendMessage(message);
        },
        
        getWindowInsets: function(){
            const insetsJson = AndroidBridge.getWindowInsets();
            try {
                return JSON.parse(insetsJson);
            } catch (e) {
                console.error('Error parsing window insets JSON:', e);
                return null;
            }
        },

        setLocalStorageItem: function(key, value) {
            if (typeof key !== 'string' || !key) {
                console.error('Key must be a non-empty string');
                return;
            }
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            AndroidBridge.setLocalStorageItem(key, value);
        },

        getLocalStoageItem: function(key) {
            if (typeof key !== 'string' || !key) {
                console.error('Key must be a non-empty string');
                return null;
            }
            const value = AndroidBridge.getLocalStorageItem(key);
            return value; // Assuming value is already a string, if it's JSON, it should be parsed by the caller
        },

        getFriendDetails: async function(userId) {
            const userJson = await AndroidBridge.getFriendDetails(userId);
            return this.parseUser(userJson);
        },
        
        isStandaloneMode: function() {
            return AndroidBridge.isStandaloneMode() === 'true';
        },
        
        getUserId: function() {
            return AndroidBridge.getUserId();
        },
        
        setOnMessageReceivedListener: function(callback) {
            if (typeof callback === 'function') {
                this.messageListeners.push(callback);
            } else {
                console.error('Message listener must be a function');
            }
        },
        
        onMessageReceived: function(message) {
            let parsedMessage;
            console.log('Message received: ', message.toString());
            try {
                // If message is a JSON string, parse it
                if (typeof message === 'string') {
                    parsedMessage = JSON.parse(message);
                } else {
                    parsedMessage = message;
                }
            } catch (e) {
                parsedMessage = message;
            }
        
            // Notify all registered listeners
            this.messageListeners.forEach(listener => {
                try {
                    listener(parsedMessage);
                } catch (error) {
                    console.error('Error in message listener:', error);
                }
            });
        }
    };
    
    // Dispatch ready event
    const readyEvent = new Event('pulgramready');
    document.dispatchEvent(readyEvent);
    console.log('Pulgram bridge initialized');
}