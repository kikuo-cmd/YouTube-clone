const SUPABASE_URL = "https://qjhzrofmxadaurelkeuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_-7jdEH1uLg8gJCCXkQaJ0g_2ZcoLm52";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const videoTitleInput = document.getElementById('videoTitle');
const videoFileInput = document.getElementById('videoFile');
const thumbFileInput = document.getElementById('thumbFile');
const uploadBtn = document.getElementById('uploadBtn');
const videoGrid = document.getElementById('videoGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

window.addEventListener('DOMContentLoaded', () => fetchVideos());
searchBtn.addEventListener('click', () => fetchVideos(searchInput.value));

// 1. 動画とコメントを取得して本家風にレンダリング
async function fetchVideos(searchQuery = "") {
    videoGrid.innerHTML = "<p style='color:#aaa;'>読み込み中...</p>";
    
    let query = supabase.from('videos').select('*').order('created_at', { ascending: false });
    
    // 検索ワードがあれば絞り込む
    if (searchQuery.trim() !== "") {
        query = query.ilike('title', `%${searchQuery}%`);
    }

    const { data: videos, error } = await query;

    if (error) {
        videoGrid.innerHTML = "<p style='color:red;'>動画の取得に失敗しました</p>";
        return;
    }

    videoGrid.innerHTML = "";

    if (videos.length === 0) {
        videoGrid.innerHTML = "<p style='color:#aaa;'>動画が見つかりませんでやんす</p>";
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

        card.innerHTML = `
            <div class="video-thumbnail-wrapper">
                <video src="${video.video_url}" controls></video>
                ${thumbHtml}
            </div>
            <div class="video-details">
                <div class="channel-icon"></div>
                <div class="video-meta">
                    <p class="video-title">${escapeHtml(video.title)}</p>
                    <p class="channel-name">マイチャンネル</p>
                    
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

// 2. 投稿できないバグを完全攻略したアップロード処理
uploadBtn.addEventListener('click', async () => {
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
        // エラー回避のためファイル名は半角英数・記号のみにクレンジング
        const cleanVideoName = `${Date.now()}_video.mp4`;
        
        // Storageへ動画アップロード
        const { error: videoError } = await supabase.storage
            .from('video-bucket')
            .upload(cleanVideoName, videoFile);

        if (videoError) throw videoError;

        const { data: { publicUrl: videoUrl } } = supabase.storage
            .from('video-bucket')
            .getPublicUrl(cleanVideoName);

        // サムネイルのアップロード（あれば）
        let thumbnailUrl = null;
        if (thumbFile) {
            const cleanThumbName = `${Date.now()}_thumb.jpg`;
            const { error: thumbError } = await supabase.storage
                .from('video-bucket')
                .upload(cleanThumbName, thumbFile);

            if (thumbError) throw thumbError;

            const { data: { publicUrl: pUrl } } = supabase.storage
                .from('video-bucket')
                .getPublicUrl(cleanThumbName);
            thumbnailUrl = pUrl;
        }

        // データベース（videosテーブル）へレコード挿入
        const { error: dbError } = await supabase
            .from('videos')
            .insert([{ title: title, video_url: videoUrl, thumbnail_url: thumbnailUrl }]);

        if (dbError) throw dbError;

        alert("本物のYouTube構図に投稿が成功したでやんす！");
        videoTitleInput.value = "";
        videoFileInput.value = "";
        thumbFileInput.value = "";
        fetchVideos();

    } catch (error) {
        console.error(error);
        alert("投稿失敗: " + error.message + "\n※SupabaseのStorage(video-bucket)が作成されているか、ポリシーがPublicになっているか確認してください。");
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerText = "公開";
    }
});

// コメント追加
window.addComment = async function(videoId) {
    const input = document.getElementById(`input-${videoId}`);
    const content = input.value;
    if (!content) return;

    const { error } = await supabase.from('comments').insert([{ video_id: videoId, content: content }]);
    if (error) {
        alert("コメント送信エラー: " + error.message);
    } else {
        input.value = "";
        fetchVideos(searchInput.value);
    }
};

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}
