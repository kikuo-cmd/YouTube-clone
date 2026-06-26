const SUPABASE_URL = "https://qjhzrofmxadaurelkeuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_-7jdEH1uLg8gJCCXkQaJ0g_2ZcoLm52";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

window.addEventListener('DOMContentLoaded', async () => {
    // 1. ログイン状態の監視
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        updateAuthUI();
        fetchVideos("");
    });

    const uploadBtn = document.getElementById('uploadBtn');
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');

    if (searchBtn) searchBtn.addEventListener('click', () => fetchVideos(searchInput.value));
    if (uploadBtn) uploadBtn.addEventListener('click', handleUpload);
});

// 認証UIの切り替え
function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    const uploadBox = document.getElementById('uploadBox');
    const loginAlert = document.getElementById('loginAlert');

    if (currentUser) {
        authBtn.innerText = "ログアウト";
        authBtn.onclick = () => supabase.auth.signOut();
        userInfo.innerText = currentUser.email.split('@')[0] + " さん";
        if (uploadBox) uploadBox.style.display = "block";
        if (loginAlert) loginAlert.style.display = "none";
    } else {
        authBtn.innerText = "ログイン / 新規登録";
        authBtn.onclick = handleAuth;
        userInfo.innerText = "";
        if (uploadBox) uploadBox.style.display = "none";
        if (loginAlert) loginAlert.style.display = "block";
    }
}

// ログイン・新規登録のポップアップ処理
async function handleAuth() {
    const email = prompt("メールアドレスを入力してください:");
    if (!email) return;
    const password = prompt("パスワードを入力してください（6文字以上）:");
    if (!password) return;

    // まずはログインを試みる
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    // ログインに失敗したら新規アカウント作成を試みる
    if (error) {
        alert("アカウントが見つからないかパスワードが違います。新規登録を試みます...");
        let { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        
        if (signUpError) {
            alert("登録失敗でやんす: " + signUpError.message);
        } else {
            alert("新しくアカウントを作成してログインしたでやんす！");
        }
    } else {
        alert("ログイン成功でやんす！");
    }
}

// 動画一覧の取得
async function fetchVideos(searchQuery = "") {
    const videoGrid = document.getElementById('videoGrid');
    if(!videoGrid) return;
    videoGrid.innerHTML = "<p style='color:#aaa;'>読み込み中...</p>";
    
    let query = supabase.from('videos').select('*').order('created_at', { ascending: false });
    if (searchQuery.trim() !== "") {
        query = query.ilike('title', `%${searchQuery}%`);
    }

    const { data: videos, error } = await query;
    if (error) {
        videoGrid.innerHTML = "<p style='color:red;'>取得失敗しました</p>";
        return;
    }

    videoGrid.innerHTML = "";
    if (videos.length === 0) {
        videoGrid.innerHTML = "<p style='color:#aaa;'>動画がありません</p>";
        return;
    }

    for (const video of videos) {
        const { data: comments } = await supabase
            .from('comments')
            .select('*')
            .eq('video_id', video.id)
            .order('created_at', { ascending: true });

        const card = document.createElement('div');
        card.className = 'video-card';
        
        let thumbHtml = '';
        if (video.thumbnail_url) {
            thumbHtml = `<div class="thumbnail-img" style="background-image: url('${video.thumbnail_url}');" onclick="this.remove()"></div>`;
        }

        let commentsHtml = '';
        if (comments && comments.length > 0) {
            commentsHtml = comments.map(c => `<div class="comment-item">${escapeHtml(c.content)}</div>`).join('');
        } else {
            commentsHtml = `<div class="comment-item" style="color:#666;">コメントなし</div>`;
        }

        // 自分が投稿した動画なら削除ボタンを表示
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
                    <p class="channel-name" style="font-size:12px; color:#aaa;">投稿者ID: ${video.user_id ? video.user_id.substring(0,6) : 'ゲスト'}</p>
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

// アップロード処理（ログインユーザーのIDを紐付け）
async function handleUpload() {
    if (!currentUser) {
        alert("ログインしてないと投稿できないでやんす！");
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
        alert("タイトルと動画ファイルは必須でやんす！");
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerText = "アップロード中...";

    try {
        const cleanVideoName = `${Date.now()}_video.mp4`;
        const { error: videoError } = await supabase.storage.from('video-bucket').upload(cleanVideoName, videoFile);
        if (videoError) throw videoError;
        const { data: { publicUrl: videoUrl } } = supabase.storage.from('video-bucket').getPublicUrl(cleanVideoName);

        let thumbnailUrl = null;
        if (thumbFile) {
            const cleanThumbName = `${Date.now()}_thumb.jpg`;
            const { error: thumbError } = await supabase.storage.from('video-bucket').upload(cleanThumbName, thumbFile);
            if (thumbError) throw thumbError;
            const { data: { publicUrl: pUrl } } = supabase.storage.from('video-bucket').getPublicUrl(cleanThumbName);
            thumbnailUrl = pUrl;
        }

        // user_id を一緒に保存するでやんす！
        const { error: dbError } = await supabase
            .from('videos')
            .insert([{ title: title, video_url: videoUrl, thumbnail_url: thumbnailUrl, user_id: currentUser.id }]);

        if (dbError) throw dbError;

        alert("投稿に成功したでやんす！");
        videoTitleInput.value = "";
        videoFileInput.value = "";
        thumbFileInput.value = "";
        fetchVideos("");

    } catch (error) {
        alert("投稿失敗: " + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerText = "公開";
    }
}

// 動画を削除する関数
window.deleteVideo = async function(videoId) {
    if (!confirm("本当にこの動画を削除してよろしいですか？")) return;

    const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

    if (error) {
        alert("削除エラー: " + error.message);
    } else {
        alert("動画を削除しました！");
        fetchVideos("");
    }
};

// コメント投稿
window.addComment = async function(videoId) {
    const input = document.getElementById(`input-${videoId}`);
    if(!input) return;
    const content = input.value;
    if (!content) return;

    const { error } = await supabase.from('comments').insert([{ video_id: videoId, content: content }]);
    if (error) {
        alert("コメント送信エラー: " + error.message);
    } else {
        input.value = "";
        const searchInput = document.getElementById('searchInput');
        fetchVideos(searchInput ? searchInput.value : "");
    }
};

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}
