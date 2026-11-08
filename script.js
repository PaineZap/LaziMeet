// DOM Elements
const homeScreen = document.getElementById('home-screen');
const meetingScreen = document.getElementById('meeting-screen');
const creatorNameInput = document.getElementById('creator-name');
const joinNameInput = document.getElementById('join-name');
const roomCodeInput = document.getElementById('room-code-input');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const currentRoomBadge = document.getElementById('current-room-badge');
const btnCopyLink = document.getElementById('btn-copy-link');

let jitsiApi = null;

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Auto fill room from URL if shared
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomCodeInput.value = roomParam;
        document.querySelector('[data-tab="join"]').click();
    }

    const randomNames = ['Nam Phong', 'Thảo My', 'Gia Hân', 'Hoàng Long', 'Minh Thư', 'Quốc Bảo'];
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

// Create Room Action
btnCreateRoom.addEventListener('click', () => {
    const name = creatorNameInput.value.trim() || 'GenZ Host';
    const roomId = 'lazimeet-' + Math.random().toString(36).substring(2, 9);
    startMeeting(roomId, name);
});

// Join Room Action
btnJoinRoom.addEventListener('click', () => {
    const name = joinNameInput.value.trim() || 'GenZ Guest';
    let roomInput = roomCodeInput.value.trim();
    if (!roomInput) {
        showToast('Vui lòng nhập mã phòng hoặc tên phòng!', 'fa-solid fa-circle-exclamation');
        return;
    }
    if (roomInput.includes('room=')) {
        try {
            const url = new URL(roomInput.includes('http') ? roomInput : 'https://' + roomInput);
            roomInput = url.searchParams.get('room') || roomInput;
        } catch (e) {}
    }
    startMeeting(roomInput, name);
});

function startMeeting(roomId, displayName) {
    homeScreen.classList.remove('active');
    meetingScreen.classList.add('active');
    currentRoomBadge.textContent = `Phòng: ${roomId}`;
    showToast('Đang kết nối vào phòng họp...', 'fa-solid fa-spinner fa-spin');

    // Cấu hình Jitsi Meet API
    const domain = "8x8.vc"; // Hoặc "meet.jit.si"
    const options = {
        roomName: "vpaas-magic-cookie-4c07923f03864a958b4562c1bc980f74/" + roomId, // Tạo phòng sạch trên Jitsi
        width: "100%",
        height: "100%",
        parentNode: document.querySelector('#jitsi-container'),
        userInfo: {
            displayName: displayName
        },
        configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false // Bỏ qua trang chờ để vào thẳng phòng
        },
        interfaceConfigOverwrite: {
            // Tùy chỉnh giao diện Jitsi cho gọn gàng, hiện đại
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'chat', 'settings', 'raisehand',
                'videoquality', 'tileview'
            ],
            SHOW_JITSI_WATERMARK: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Thành viên'
        }
    };

    jitsiApi = new JitsiMeetExternalAPI(domain, options);

    jitsiApi.addEventListeners({
        readyToClose: () => {
            // Khi bấm nút rời phòng (hangup)
            window.location.href = window.location.pathname;
        },
        participantJoined: (participant) => {
            showToast(`${participant.displayName || 'Một thành viên'} đã vào phòng`, 'fa-solid fa-user-plus');
        }
    });
}

// Copy Link Button
btnCopyLink.addEventListener('click', () => {
    const currentUrl = window.location.origin + window.location.pathname + '?room=' + currentRoomBadge.textContent.replace('Phòng: ', '');
    navigator.clipboard.writeText(currentUrl);
    showToast('Đã sao chép đường dẫn mời vào bộ nhớ tạm!', 'fa-solid fa-clipboard-check');
});
