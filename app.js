// 提供してもらったSupabaseの接続情報
const SUPABASE_URL = 'https://qjhzrofmxadaurelkeuc.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_-7jdEH1uLg8gJCCXkQaJ0g_2ZcoLm52';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 画面の要素を取得
const authBtn = document.getElementById('authBtn');
const userInfo = document.getElementById('userInfo');
const videoGrid = document.getElementById('videoGrid');
const dashboardOverlay = document.getElementById('dashboardOverlay');
const dashboardCloseBtn = document.getElementById('dashboardCloseBtn');
const uploadBtn = document.getElementById('uploadBtn');

const videoTitleInput = document.getElementById('videoTitle');
const videoFileInput = document.getElementById('videoFile');
const thumbFileInput = document.getElementById('thumbFile');

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// ── 1. ログイン状態のチェック ──
async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        authBtn.innerText = user.email.substring(0, 2).toUpperCase();
        userInfo.innerText = user.email;
        if (user.user_metadata && user.user_metadata.avatar_url) {
            authBtn.style.backgroundImage = `url('${user.user_metadata.avatar_url}')`;
            authBtn.innerText = '';
        }
    } else {
        authBtn.innerText = '👤';
        userInfo.innerText = '';
        authBtn.style.backgroundImage = 'none';
    }
}

// 👤 ログイン処理
authBtn.addEventListener('click', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        const email = prompt("メールアドレスを入力してください:");
        const password = prompt("パスワードを入力してください:");
        if (email && password) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                const { error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) alert("エラー: " + signUpError.message);
                else alert("アカウントを作成しました！確認メールをチェックするか、再度ログインしてください。");
            } else {
                location.reload();
            }
        }
    }
});

// 🚪 ログアウトボタン
document.getElementById('menuLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
});

// ── 2. 動画データの読み込み ──
async function loadVideos(searchQuery = '') {
    if (!videoGrid) return;
    videoGrid.innerHTML = '';

    let query = supabase.from('videos').select('*').order('created_at', { ascending: false });
    
    if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
    }

    const { data: videos, error } = await query;

    if (error) {
        console.error("動画の取得に失敗:", error);
        videoGrid.innerHTML = `<div class="no-videos-message">データの読み込みに失敗しました</div>`;
        return;
    }

    if (!videos || videos.length === 0) {
        videoGrid.innerHTML = `<div class="no-videos-message">投稿された動画がまだありません。右上のメニューから投稿してみてね！</div>`;
        return;
    }

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        const thumbUrl = video.thumbnail_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400';

        card.innerHTML = `
            <div class="video-thumbnail-wrapper">
                <div class="thumbnail-img" style="background-image: url('${thumbUrl}')"></div>
                <video src="${video.video_url}" loop muted playsinline></video>
            </div>
            <div class="video-details">
                <div class="channel-icon"></div>
                <div class="video-meta">
                    <p class="video-title" title="${video.title}">${video.title}</p>
                    <p class="channel-name">マイチャンネル</p>
                    <p class="video-sub-info">0回視聴 ・ たった今</p>
                </div>
            </div>
        `;

        const videoEl = card.querySelector('video');
        const thumbEl = card.querySelector('.thumbnail-img');
        card.addEventListener('mouseenter', () => {
            thumbEl.style.display = 'none';
            videoEl.play().catch(() => {});
        });
        card.addEventListener('mouseleave', () => {
            videoEl.pause();
            videoEl.currentTime = 0;
            thumbEl.style.display = 'block';
        });

        videoGrid.appendChild(card);
    });
}

// ── 3. 動画アップロード ──
dashboardCloseBtn.addEventListener('click', () => {
    dashboardOverlay.style.display = 'none';
});

uploadBtn.addEventListener('click', async () => {
    const title = videoTitleInput.value.trim();
    const videoFile = videoFileInput.files[0];
    const thumbFile = thumbFileInput.files[0];

    if (!title || !videoFile) {
        alert("タイトルと動画ファイルは必須でやんす！");
        return;
    }

    uploadBtn.innerText = "アップロード中...";
    uploadBtn.disabled = true;

    try {
        const videoName = `${Date.now()}_${videoFile.name}`;
        const { data: vData, error: vError } = await supabase.storage.from('videos').upload(videoName, videoFile);
        if (vError) throw vError;
        const { data: vUrlData } = supabase.storage.from('videos').getPublicUrl(videoName);

        let thumbnailUrl = '';
        if (thumbFile) {
            const thumbName = `${Date.now()}_${thumbFile.name}`;
            const { error: tError } = await supabase.storage.from('thumbnails').upload(thumbName, thumbFile);
            if (!tError) {
                thumbnailUrl = supabase.storage.from('thumbnails').getPublicUrl(thumbName).data.publicUrl;
            }
        }

        const { error: dbError } = await supabase.from('videos').insert([
            { title: title, video_url: vUrlData.publicUrl, thumbnail_url: thumbnailUrl }
        ]);
        if (dbError) throw dbError;

        alert("公開が完了したでやんす！");
        dashboardOverlay.style.display = 'none';
        videoTitleInput.value = '';
        videoFileInput.value = '';
        thumbFileInput.value = '';
        loadVideos();

    } catch (err) {
        alert("失敗しました: " + err.message);
    } finally {
        uploadBtn.innerText = "公開";
        uploadBtn.disabled = false;
    }
});

// 検索機能
searchBtn.addEventListener('click', () => loadVideos(searchInput.value));
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadVideos(searchInput.value);
});

checkUser();
loadVideos();
