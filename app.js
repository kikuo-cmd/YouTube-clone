const SUPABASE_URL = "https://qjhzrofmxadaurelkeuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_-7jdEH1uLg8gJCCXkQaJ0g_2ZcoLm52";

// Supabaseクライアントの初期化
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;

// 画面の読み込み完了時にイベントを登録
window.addEventListener('load', async () => {
    console.log("YouTube Clone: システムが正常に起動しました。");

    // 1. ログイン状態の監視を開始
    _supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        updateAuthUI();
        fetchVideos("");
    });

    // 各種UI要素の取得とイベントリスナーの登録
    const uploadBtn = document.getElementById('uploadBtn');
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const authBtn = document.getElementById('authBtn');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => fetchVideos(searchInput.value));
    }
    if (uploadBtn) {
        uploadBtn.addEventListener('click', handleUpload);
    }
    if (authBtn) {
        authBtn.addEventListener('click', handleAuth);
    }
});

// 認証状態に応じてUIを更新する関数
function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    const uploadBox = document.getElementById('uploadBox');
    const loginAlert = document.getElementById('loginAlert');

    if (!authBtn) return;

    if (currentUser) {
        authBtn.innerText = "ログアウト";
        userInfo.innerText = currentUser.email.split('@')[0] + " さん";
        if (uploadBox) uploadBox.style.display = "block";
        if (loginAlert) loginAlert.style.display = "none";
    } else {
        authBtn.innerText = "ログイン / 新規登録";
        userInfo.innerText = "";
        if (uploadBox) uploadBox.style.display = "none";
        if (loginAlert) loginAlert.style.display = "block";
    }
}

// ログイン・新規登録の処理を行う関数
async function handleAuth() {
    if (currentUser) {
        const { error } = await _supabase.auth.signOut();
        if (error) alert("ログアウトに失敗しました: " + error.message);
        return;
    }

    const email = prompt("メールアドレスを入力してください:");
    if (!email) return;
    const password = prompt("パスワードを入力してください（6文字以上）:");
    if (!password) return;

    // 既存アカウントでのログインを試行
    let { data, error } = await _supabase.auth.signInWithPassword({ email, password });
    
    // ログイン失敗時は新規アカウント作成を試行
    if (error) {
        console.log("アカウントが存在しないか未確認のため、新規登録を試みます:", error.message);
        let { data: signUpData, error: signUpError } = await _supabase.auth.signUp({ email, password });
        
        if (signUpError) {
            alert("ログインおよび新規登録に失敗しました:\n" + signUpError.message);
        } else {
            alert("新しくアカウントを作成し、ログインしました。");
        }
    } else {
        alert("ログインに成功しました。");
    }
}

// 動画一覧を取得して表示する関数
async function fetchVideos(searchQuery = "") {
    const videoGrid = document.getElementById('videoGrid');
    if (!videoGrid) return;
    videoGrid.innerHTML = "<p style='color:#aaa;'>動画を読み込み中です...</p>";
    
    let query = _supabase.from('videos').select('*').order('created_at', { ascending: false });
    if (searchQuery.trim() !== "") {
        query = query.ilike('title', `%${searchQuery}%`);
    }

    const { data: videos, error } = await query;
    if (error) {
        videoGrid.innerHTML = "<p style='color:red;'>動画データの取得に失敗しました。</p>";
        return;
    }

    videoGrid.innerHTML = "";
    if (videos.length === 0) {
        videoGrid.innerHTML = "<p style='color:#aaa;'>該当する動画がありません。</p>";
        return;
    }

    for (const video of videos) {
        // 動画に関連するコメントを取得
        const { data: comments } = await _supabase
            .from('comments')
            .select('*')
            .eq('video_id', video.id)
            .order('created_at', { ascending: true });

        const card = document.createElement('div');
        card.className = 'video-card';
        
        let thumbHtml = '';
        if (video.thumbnail_url) {
            thumbHtml = `<div class="thumbnail-img" style="background-image: url('${video.thumbnail_url}');"></div>`;
        }

        let commentsHtml = '';
        if (comments && comments.length > 0) {
            commentsHtml = comments.map(c => `<div class="comment-item">${escapeHtml(c.content)}</div>`).join('');
        } else {
            commentsHtml = `<div class="comment-item" style="color:#666;">コメントはまだありません。</div>`;
        }

        // 投稿者本人の場合のみ削除ボタンを表示
        const isMyVideo = currentUser && video.user_id === currentUser.id;
        const deleteBtnHtml = isMyVideo ? `<button class="delete-btn" style="display:block;" onclick="deleteVideo(${video.id})">🗑️</button>` : '';

        card.innerHTML = `
            <div class="video-thumbnail-wrapper">
                <video src="${video.video_url}" controls></video>
                ${thumbHtml}
            </div>
            <div class="video-details">
                <div class="channel-icon"></div>
                <div class="video-meta">
                    <p class="video-title">${escapeHtml(video.title)}</p>
                    ${deleteBtnHtml}
                    <p class="channel-name" style="font-size:12px; color:#aaa;">投稿者: ${video.user_id ? video.user_id.substring(0,6) : 'ゲスト'}</p>
                    <div class="comment-section">
                        <div class="comment-list">
                            ${commentsHtml}
                        </div>
                        <div class="comment-input-box">
                            <input type="text" id="input-${video.id}" placeholder="コメントを追加...">
                            <button onclick="addComment(${video.id})">送信</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        videoGrid.appendChild(card);
    }
}

// 動画およびサムネイルをアップロードする関数
async function handleUpload() {
    if (!currentUser) {
        alert("動画を投稿するにはログインが必要です。");
        return;
    }

    const videoTitleInput = document.getElementById('videoTitle');
    const videoFileInput = document.getElementById('videoFile');
    const thumbFileInput = document.getElementById('thumbFile');
    const uploadBtn = document.getElementById('uploadBtn');

    const title = videoTitleInput.value;
    const videoFile = videoFileInput.files[0];
    const thumbFile = thumbFileInput.files[0];

    if (!title || !videoFile) {
        alert("タイトルと動画ファイルを選択してください。");
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerText = "アップロード中...";

    try {
        // 動画ファイルのアップロード
        const cleanVideoName = `${Date.now()}_video.mp4`;
        const { error: videoError } = await _supabase.storage.from('video-bucket').upload(cleanVideoName, videoFile);
        if (videoError) throw videoError;
        const { data: { publicUrl: videoUrl } } = _supabase.storage.from('video-bucket').getPublicUrl(cleanVideoName);

        // サムネイルファイルのアップロード（任意）
        let thumbnailUrl = null;
        if (thumbFile) {
            const cleanThumbName = `${Date.now()}_thumb.jpg`;
            const { error: thumbError } = await _supabase.storage.from('video-bucket').upload(cleanThumbName, thumbFile);
            if (thumbError) throw thumbError;
            const { data: { publicUrl: pUrl } } = _supabase.storage.from('video-bucket').getPublicUrl(cleanThumbName);
            thumbnailUrl = pUrl;
        }

        // 【修正ポイント】thumbnailUrl を データベースの列名 thumbnail_url に合わせて保存します
        const { error: dbError } = await _supabase
            .from('videos')
            .insert([{ title: title, video_url: videoUrl, thumbnail_url: thumbnailUrl, user_id: currentUser.id }]);

        if (dbError) throw dbError;

        alert("動画の公開に成功しました。");
        videoTitleInput.value = "";
        videoFileInput.value = "";
        thumbFileInput.value = "";
        fetchVideos("");

    } catch (error) {
        alert("投稿エラーが発生しました:\n" + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerText = "公開";
    }
}

// 動画を削除する関数
window.deleteVideo = async function(videoId) {
    if (!confirm("本当にこの動画を削除しますか？")) return;

    const { error } = await _supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

    if (error) {
        alert("削除に失敗しました: " + error.message);
    } else {
        alert("動画を削除しました。");
        fetchVideos("");
    }
};

// コメントを追加する関数
window.addComment = async function(videoId) {
    const input = document.getElementById(`input-${videoId}`);
    if (!input) return;
    const content = input.value;
    if (!content) return;

    const { error } = await _supabase.from('comments').insert([{ video_id: videoId, content: content }]);
    if (error) {
        alert("コメントの送信に失敗しました: " + error.message);
    } else {
        input.value = "";
        const searchInput = document.getElementById('searchInput');
        fetchVideos(searchInput ? searchInput.value : "");
    }
};

// HTMLエスケープ処理（セキュリティ対策）
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}
