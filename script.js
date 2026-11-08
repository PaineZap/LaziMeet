/**
 * LAZIMEET - WebRTC Peer-to-Peer Video Conferencing
 * Built with HTML5, CSS3, Vanilla JS and PeerJS Cloud (Free Signaling)
 */

// State Variables
let peer = null;
let localStream = null;
let currentRoomId = null;
let myName = "GenZ User";
let isHost = false;
let peersList = {}; // peerId -> { call, stream, name }

let isMicMuted = false;
let isCamOff = false;
let isScreenSharing = false;
let screenStream = null;
let callStartTime = null;
let timerInterval = null;

// DOM Elements
const homeScreen = document.getElementById('home-screen');
const meetingScreen = document.getElementById('meeting-screen');
const creatorNameInput = document.getElementById('creator-name');
const joinNameInput = document.getElementById('join-name');
const roomCodeInput = document.getElementById('room-code-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');

const localVideo = document.getElementById('local-video');
const localUserLabel = document.getElementById('local-user-label');
const localAvatarFallback = document.getElementById('local-avatar-fallback');
const localAvatarInitials = document.getElementById('local-avatar-initials');
const videoGrid = document.getElementById('video-grid');
const currentRoomBadge = document.getElementById('current-room-badge');

const btnToggleMic = document.getElementById('btn-toggle-mic');
const btnToggleCam = document.getElementById('btn-toggle-cam');
const btnShareScreen = document.getElementById('btn-share-screen');
const btnLeaveRoom = document.getElementById('btn-leave-room');
const btnToggleTheme = document.getElementById('btn-toggle-theme');

const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const sidebarPanel = document.getElementById('sidebar-panel');
const btnCloseSidebar = document.getElementById('btn-close-sidebar');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const btnSendChat = document.getElementById('btn-send-chat');
const participantsList = document.getElementById('participants-list');
const participantCount = document.getElementById('participant-count');
const badgeUnread = document.getElementById('badge-unread');

const shareModal = document.getElementById('share-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCopyLink = document.getElementById('btn-copy-link');
const shareLinkInput = document.getElementById('share-link-input');
const btnCopyModalLink = document.getElementById('btn-copy-modal-link');
const meetingTimer = document.getElementById('meeting-timer');

// Tab Navigation on Home
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Sidebar Tabs in Meeting
document.querySelectorAll('.side-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.side-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        if(targetId === 'chat-section') {
            badgeUnread.textContent = '0';
            badgeUnread.style.display = 'none';
        }
    });
});

// Auto check URL parameters for direct room joining
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomCodeInput.value = roomParam;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="join"]').classList.add('active');
        document.getElementById('join-tab').classList.add('active');
    }

    const randomNames = ['Nam Phong', 'Thảo My', 'Gia Hân', 'Hoàng Long', 'Minh Thư', 'Quốc Bảo', 'Khánh Linh'];
    const defaultName = randomNames[Math.floor(Math.random() * randomNames.length)];
    creatorNameInput.value = defaultName;
    joinNameInput.value = defaultName;
});

function showToast(message, icon = 'fa-solid fa-sparkles') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

async function initLocalMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        localVideo.play();
        localAvatarFallback.style.display = 'none';
    } catch (err) {
        console.warn('Không thể bật camera/mic:', err);
        showToast('Không tìm thấy Camera/Mic. Vào phòng chế độ chỉ nghe/nhìn.', 'fa-solid fa-triangle-exclamation');
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localAvatarFallback.style.display = 'flex';
        } catch (e) {
            localStream = new MediaStream();
            localAvatarFallback.style.display = 'flex';
        }
    }
}

btnCreateRoom.addEventListener('click', async () => {
    const name = creatorNameInput.value.trim() || 'GenZ Host';
    myName = name;
    isHost = true;
    const roomId = 'lazimeet-' + Math.random().toString(36).substring(2, 9);
    await startMeeting(roomId, true);
});

btnJoinRoom.addEventListener('click', async () => {
    const name = joinNameInput.value.trim() || 'GenZ Guest';
    myName = name;
    isHost = false;
    let roomInput = roomCodeInput.value.trim();
    if (!roomInput) {
        showToast('Vui lòng nhập mã phòng hoặc đường dẫn!', 'fa-solid fa-circle-exclamation');
        return;
    }
    if (roomInput.includes('room=')) {
        try {
            const url = new URL(roomInput.includes('http') ? roomInput : 'https://' + roomInput);
            roomInput = url.searchParams.get('room') || roomInput;
        } catch (e) {}
    }
    await startMeeting(roomInput, false);
});

async function startMeeting(roomId, asHost) {
    currentRoomId = roomId;
    showToast('Đang kết nối vào phòng họp...', 'fa-solid fa-spinner fa-spin');
    
    await initLocalMedia();

    localUserLabel.textContent = `${myName} (Bạn)`;
    localAvatarInitials.textContent = getInitials(myName);

    // If host, peerId = roomId + '-host'. If guest, peerId = roomId + '-guest-' + random
    // This allows predictable host addressing in PeerJS cloud!
    const peerId = asHost ? (roomId + '-host') : (roomId + '-guest-' + Math.random().toString(36).substring(2, 6));

    peer = new Peer(peerId, { debug: 1 });

    peer.on('open', (id) => {
        console.log('My peer ID:', id);
        transitionToMeetingScreen();

        if (!asHost) {
            // Connect to host
            connectToHost(roomId);
        }
    });

    peer.on('call', (call) => {
        call.answer(localStream);
        setupCallEventHandlers(call);
    });

    peer.on('connection', (conn) => {
        setupDataConnectionHandlers(conn);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        if (err.type === 'unavailable-id') {
            showToast('Phòng này đã có chủ hoặc mã phòng trùng. Thử lại nhé!', 'fa-solid fa-triangle-exclamation');
        } else {
            showToast('Lỗi kết nối: ' + err.type, 'fa-solid fa-triangle-exclamation');
        }
    });
}

function connectToHost(roomId) {
    const hostPeerId = roomId + '-host';
    
    // Connect data channel to host
    const conn = peer.connect(hostPeerId, { metadata: { name: myName } });
    if (conn) {
        setupDataConnectionHandlers(conn);
        conn.on('open', () => {
            conn.send({ type: 'join', name: myName, peerId: peer.id });
        });
    }

    // Call host
    const call = peer.call(hostPeerId, localStream, { metadata: { name: myName } });
    if (call) {
        setupCallEventHandlers(call);
    }
}

function transitionToMeetingScreen() {
    homeScreen.classList.remove('active');
    meetingScreen.classList.add('active');
    currentRoomBadge.textContent = `Phòng: ${currentRoomId}`;
    
    const shareUrl = window.location.origin + window.location.pathname + '?room=' + currentRoomId;
    shareLinkInput.value = shareUrl;

    callStartTime = Date.now();
    timerInterval = setInterval(updateMeetingTimer, 1000);

    updateParticipantsList();
    showToast('Đã vào phòng họp thành công!', 'fa-solid fa-circle-check');
}

function setupCallEventHandlers(call) {
    call.on('stream', (remoteStream) => {
        const remotePeerId = call.peer;
        if (!peersList[remotePeerId]) {
            const peerName = call.metadata?.name || 'Thành viên';
            peersList[remotePeerId] = { call: call, stream: remoteStream, name: peerName };
            addRemoteVideoCard(remotePeerId, remoteStream, peerName);
            updateParticipantsList();
            showToast(`${peerName} đã tham gia phòng`, 'fa-solid fa-user-plus');
        }
    });

    call.on('close', () => {
        removeRemoteVideoCard(call.peer);
    });
}

function setupDataConnectionHandlers(conn) {
    conn.on('data', (data) => {
        if (data.type === 'chat') {
            appendChatMessage(data.sender, data.text, 'theirs');
            if (sidebarPanel.classList.contains('hidden')) {
                let currentCount = parseInt(badgeUnread.textContent) || 0;
                badgeUnread.textContent = currentCount + 1;
                badgeUnread.style.display = 'inline-block';
            }
        } else if (data.type === 'join' && isHost) {
            // If we are host and someone joined, we can also call them if not already called
            const newPeerId = data.peerId;
            if (newPeerId && !peersList[newPeerId]) {
                const call = peer.call(newPeerId, localStream, { metadata: { name: myName } });
                if (call) {
                    setupCallEventHandlers(call);
                }
            }
        }
    });
}

function addRemoteVideoCard(peerId, stream, name) {
    if (document.getElementById(`video-card-${peerId}`)) return;

    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = `video-card-${peerId}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    overlay.innerHTML = `
        <span class="user-tag">${name}</span>
        <div class="status-icons">
            <i class="fa-solid fa-microphone"></i>
            <i class="fa-solid fa-video"></i>
        </div>
    `;

    const avatarFallback = document.createElement('div');
    avatarFallback.className = 'avatar-fallback';
    avatarFallback.style.display = stream.getVideoTracks().length === 0 ? 'flex' : 'none';
    avatarFallback.innerHTML = `<span>${getInitials(name)}</span>`;

    card.appendChild(video);
    card.appendChild(overlay);
    card.appendChild(avatarFallback);
    videoGrid.appendChild(card);
}

function removeRemoteVideoCard(peerId) {
    const card = document.getElementById(`video-card-${peerId}`);
    if (card) card.remove();
    if (peersList[peerId]) {
        showToast(`${peersList[peerId].name} đã rời phòng`, 'fa-solid fa-user-minus');
        delete peersList[peerId];
    }
    updateParticipantsList();
}

btnToggleMic.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isMicMuted = !audioTrack.enabled;
        btnToggleMic.className = `control-btn ${isMicMuted ? 'inactive' : 'active'}`;
        btnToggleMic.innerHTML = `<i class="fa-solid fa-microphone${isMicMuted ? '-slash' : ''}"></i>`;
        document.getElementById('mic-status-icon').className = `fa-solid fa-microphone${isMicMuted ? '-slash muted' : ''}`;
        showToast(isMicMuted ? 'Đã tắt Micro' : 'Đã bật Micro');
    }
});

btnToggleCam.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isCamOff = !videoTrack.enabled;
        btnToggleCam.className = `control-btn ${isCamOff ? 'inactive' : 'active'}`;
        btnToggleCam.innerHTML = `<i class="fa-solid fa-video${isCamOff ? '-slash' : ''}"></i>`;
        document.getElementById('cam-status-icon').className = `fa-solid fa-video${isCamOff ? '-slash muted' : ''}`;
        localAvatarFallback.style.display = isCamOff ? 'flex' : 'none';
        showToast(isCamOff ? 'Đã tắt Camera' : 'Đã bật Camera');
    }
});

btnShareScreen.addEventListener('click', async () => {
    try {
        if (!isScreenSharing) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];
            
            for (let peerId in peersList) {
                const sender = peersList[peerId].call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
            }

            localVideo.srcObject = screenStream;
            isScreenSharing = true;
            btnShareScreen.classList.add('active');
            showToast('Đang chia sẻ màn hình', 'fa-solid fa-desktop');

            screenTrack.onended = () => {
                stopScreenSharing();
            };
        } else {
            stopScreenSharing();
        }
    } catch (err) {
        console.error('Lỗi chia sẻ màn hình:', err);
        showToast('Không thể chia sẻ màn hình', 'fa-solid fa-triangle-exclamation');
    }
});

function stopScreenSharing() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
    const videoTrack = localStream.getVideoTracks()[0];
    for (let peerId in peersList) {
        const sender = peersList[peerId].call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
    }
    localVideo.srcObject = localStream;
    isScreenSharing = false;
    btnShareScreen.classList.remove('active');
    showToast('Đã dừng chia sẻ màn hình');
}

btnLeaveRoom.addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn rời phòng họp?')) {
        leaveRoom();
    }
});

function leaveRoom() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peer) {
        peer.destroy();
    }
    clearInterval(timerInterval);
    window.location.href = window.location.pathname;
}

btnToggleSidebar.addEventListener('click', () => {
    sidebarPanel.classList.toggle('hidden');
    if (!sidebarPanel.classList.contains('hidden')) {
        badgeUnread.textContent = '0';
        badgeUnread.style.display = 'none';
    }
});

btnCloseSidebar.addEventListener('click', () => {
    sidebarPanel.classList.add('hidden');
});

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendChatMessage(myName, text, 'mine');
    chatInput.value = '';

    for (let peerId in peersList) {
        const conn = peer.connect(peerId);
        conn.on('open', () => {
            conn.send({ type: 'chat', sender: myName, text: text });
        });
    }
}

btnSendChat.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

function appendChatMessage(sender, text, type) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${type}`;
    bubble.innerHTML = `
        <span class="msg-sender">${sender}</span>
        <span class="msg-text">${text}</span>
    `;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateParticipantsList() {
    participantsList.innerHTML = '';
    
    const selfItem = document.createElement('li');
    selfItem.className = 'participant-item';
    selfItem.innerHTML = `
        <div class="participant-avatar">${getInitials(myName)}</div>
        <div class="participant-info">
            <span class="participant-name">${myName} (Bạn)</span>
            <span class="participant-role">${isHost ? 'Host' : 'Thành viên'}</span>
        </div>
    `;
    participantsList.appendChild(selfItem);

    let count = 1;
    for (let peerId in peersList) {
        count++;
        const pName = peersList[peerId].name;
        const item = document.createElement('li');
        item.className = 'participant-item';
        item.innerHTML = `
            <div class="participant-avatar">${getInitials(pName)}</div>
            <div class="participant-info">
                <span class="participant-name">${pName}</span>
                <span class="participant-role">Thành viên</span>
            </div>
        `;
        participantsList.appendChild(item);
    }
    participantCount.textContent = count;
}

function updateMeetingTimer() {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const secs = (elapsed % 60).toString().padStart(2, '0');
    meetingTimer.textContent = `${mins}:${secs}`;
}

btnCopyLink.addEventListener('click', () => {
    shareModal.classList.remove('hidden');
});

btnCloseModal.addEventListener('click', () => {
    shareModal.classList.add('hidden');
});

btnCopyModalLink.addEventListener('click', () => {
    shareLinkInput.select();
    navigator.clipboard.writeText(shareLinkInput.value);
    showToast('Đã sao chép đường dẫn mời vào bộ nhớ tạm!', 'fa-solid fa-clipboard-check');
});

let themeIndex = 0;
const themes = [
    { name: 'GenZ Purple', primary: '#8B5CF6', pink: '#FF4FA3', cyan: '#22D3EE' },
    { name: 'Cyber Neon', primary: '#22D3EE', pink: '#A3E635', cyan: '#FF4FA3' },
    { name: 'Sunset Vibes', primary: '#FF8A3D', pink: '#FF4FA3', cyan: '#8B5CF6' }
];

btnToggleTheme.addEventListener('click', () => {
    themeIndex = (themeIndex + 1) % themes.length;
    const t = themes[themeIndex];
    document.documentElement.style.setProperty('--purple', t.primary);
    document.documentElement.style.setProperty('--pink', t.pink);
    document.documentElement.style.setProperty('--cyan', t.cyan);
    showToast(`Đã đổi chủ đề: ${t.name}`, 'fa-solid fa-palette');
});
