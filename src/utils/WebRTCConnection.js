export default class WebRTCConnection {
    constructor(signalingChannel, isInitiator = false) {
        this.signal = signalingChannel;
        this.isInitiator = isInitiator;

        // We use Google's public STUN servers to find our public IP
        const configuration = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };

        // 1. Initialize the native RTCPeerConnection
        this.peerConnection = new RTCPeerConnection(configuration);

        // 2. Set up local ICE Candidate gathering
        // When the STUN server finds our IP/Port, this event fires
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Gathered ICE Candidate, sending to peer...');
                this.signal.send({
                    type: 'ICE_CANDIDATE',
                    candidate: event.candidate
                });
            }
        };

        // 3. Listen for connection state changes (for UI updates)
        this.peerConnection.onconnectionstatechange = () => {
            console.log('WebRTC Connection State:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                console.log('🎉 P2P CONNECTION ESTABLISHED DIRECTLY!');
            }
        };
    }

    // --- THE HANDSHAKE METHODS ---

    /**
     * Called by Peer A (The Sender) to start the connection.
     */
    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            console.log('Created Offer, sending via signal...');
            this.signal.send({
                type: 'OFFER',
                sdp: this.peerConnection.localDescription
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }

    /**
     * Called by Peer B (The Receiver) when they get an Offer.
     */
    async handleOffer(remoteSdp) {
        try {
            console.log('Received Offer, creating Answer...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteSdp));

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.signal.send({
                type: 'ANSWER',
                sdp: this.peerConnection.localDescription
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    /**
     * Called by Peer A when they receive Peer B's Answer.
     */
    async handleAnswer(remoteSdp) {
        try {
            console.log('Received Answer, setting remote description...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteSdp));
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    /**
     * Called by both peers whenever they receive an ICE candidate from the other side.
     */
    async handleIceCandidate(candidateData) {
        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
            console.log('Successfully added remote ICE candidate.');
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
}
