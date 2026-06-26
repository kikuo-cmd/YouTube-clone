// 1. Supabaseの接続設定（キーを設定済みでやんす！）
const SUPABASE_URL = "https://qjhzrofmxadaurelkeuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_-7jdEH1uLg8gJCCXkQaJ0g_2ZcoLm52";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const videoTitleInput = document.getElementById('videoTitle');
const videoFileInput = document.getElementById('videoFile');
const thumbFileInput = document.getElementById('thumbFile'); // サムネイル用
const uploadBtn = document.getElementById('uploadBtn');
const videoGrid = document.getElementById('videoGrid');

window.addEventListener('DOMContentLoaded', fetchVideos);

// 2. 動画とコメントを一緒に取得して表示する
async function fetchVideos() {
    videoGrid.innerHTML = "読み込み中...";
    
    // videosテーブルのデータを取得
    const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("動画の取得に失敗:", error);
        videoGrid.innerHTML = "エラーが発生しました。";
        return;
    }

    videoGrid.innerHTML = "";

    for (const video of videos) {
        // この動画に紐づくコメントを取得
        const { data: comments } = await supabase
            .from('comments')
            .select('*')
            .eq('video_id', video.id)
            .order('created_at', { ascending: true });

        const card = document.createElement('div');
        card.className = 'video-card';
        
        // サムネイルがある場合は重ねる
        let thumbHtml = '';
        if (video.thumbnail_url) {
            thumbHtml = `<div class="thumbnail-overlay" style="background-image: url('${video.thumbnail_url}');" onclick="this.remove()"></div>`;
        }

        // コメントのリストを組み立てる
        let commentsHtml = '';
        if (comments && comments.length > 0) {
            commentsHtml = comments.map(c => `<div class="comment-item">${escapeHtml(c.content)}</div>`).join('');
        } else {
            commentsHtml = `<div class="comment-item" style="color:#aaa;">コメントはまだありません</div>`;
        }

        card.innerHTML = `
            <div class="video-wrapper">
                <video src="${video.video_url}" controls></video>
                ${thumbHtml}
            </div>
            <div class="video-info">
                <p class="video-title">${escapeHtml(video.title)}</p>
                
                <div class="comment-section">
                    <div class="comment-list" id="comments-${video.id}">
                        ${commentsHtml}
                    </div>
                    <div class="comment-input-box">
                        <input type="text" id="input-${video.id}" placeholder="コメントを追加...">
                        <button onclick="addComment(${video.id})">送信</button>
                    </div>
                </div>
            </div>
        `;
        videoGrid.appendChild(card);
    }
}

// 3. 動画とサムネイルをアップロードする
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
        // (A) 動画のアップロード
        const videoName = `videos/${Date.now()}_${videoFile.name}`;
        const { error: videoError } = await supabase.storage.from('video-bucket').upload(videoName, videoFile);
        if (videoError) throw videoError;
        const { data: { publicUrl: videoUrl } } = supabase.storage.from('video-bucket').getPublicUrl(videoName);

        // (B) サムネイルのアップロード（あれば）
        let thumbnailUrl = null;
        if (thumbFile) {
            const thumbName = `thumbs/${Date.now()}_${thumbFile.name}`;
            const { error: thumbError } = await supabase.storage.from('video-bucket').upload(thumbName, thumbFile);
            if (thumbError) throw thumbError;
            const { data: { publicUrl: pUrl } } = supabase.storage.from('video-bucket').getPublicUrl(thumbName);
            thumbnailUrl = pUrl;
        }

        // (C) データベースへ保存
        const { error: dbError } = await supabase
            .from('videos')
            .insert([{ title: title, video_url: videoUrl, thumbnail_url: thumbnailUrl }]);

        if (dbError) throw dbError;

        alert("投稿完了でやんす！");
        videoTitleInput.value = "";
        videoFileInput.value = "";
        thumbFileInput.value = "";
        fetchVideos();

    } catch (error) {
        alert("失敗しました: " + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerText = "投稿する";
    }
});

// 4. コメントを投稿する関数
window.addComment = async function(videoId) {
    const input = document.getElementById(`input-${videoId}`);
    const content = input.value;

    if (!content) return;

    const { error } = await supabase
        .from('comments')
        .insert([{ video_id: videoId, content: content }]);

    if (error) {
        alert("コメント送信エラー: " + error.message);
    } else {
        input.value = "";
        fetchVideos(); // 再読み込みして反映
    }
};

// セキュリティ対策
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}
