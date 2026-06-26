// 1. Supabaseの接続設定（あなたの情報に書き換えてください）
const SUPABASE_URL = "https://qjhzrofmxadaurelkeuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_-7jdEH1uLg8gJCCXkQaJ0g_2ZcoLm52";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. 画面の要素（ボタンや入力欄）を取得
const videoTitleInput = document.getElementById('videoTitle');
const videoFileInput = document.getElementById('videoFile');
const uploadBtn = document.getElementById('uploadBtn');
const videoGrid = document.getElementById('videoGrid');

// 3. ページを開いたときに動画一覧を表示する
window.addEventListener('DOMContentLoaded', fetchVideos);

async function fetchVideos() {
    videoGrid.innerHTML = "読み込み中...";
    
    // 『videos』テーブルからデータを取得
    const { data: videos, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("動画の取得に失敗:", error);
        videoGrid.innerHTML = "動画の読み込みに失敗しました。";
        return;
    }

    videoGrid.innerHTML = ""; // 読み込み文字を消す

    // 取得した動画を画面に並べる
    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <video src="${video.video_url}" controls></video>
            <div class="video-info">
                <p class="video-title">${escapeHtml(video.title)}</p>
            </div>
        `;
        videoGrid.appendChild(card);
    });
}

// 4. 投稿ボタンを押したときの処理（動画アップロード）
uploadBtn.addEventListener('click', async () => {
    const title = videoTitleInput.value;
    const file = videoFileInput.files[0];

    if (!title || !file) {
        alert("タイトルと動画ファイルを選択してください！");
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerText = "アップロード中...";

    try {
        // (A) Supabase Storage（バケット名: video-bucket）にファイルを保存
        const fileName = `${Date.now()}_${file.name}`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('video-bucket')
            .upload(fileName, file);

        if (storageError) throw storageError;

        // アップロードした動画の公開URLを取得
        const { data: { publicUrl } } = supabase.storage
            .from('video-bucket')
            .getPublicUrl(fileName);

        // (B) データベース（videosテーブル）にタイトルとURLを保存
        const { error: dbError } = await supabase
            .from('videos')
            .insert([{ title: title, video_url: publicUrl }]);

        if (dbError) throw dbError;

        alert("投稿が完了しました！");
        videoTitleInput.value = "";
        videoFileInput.value = "";
        fetchVideos(); // 一覧を更新

    } catch (error) {
        console.error("エラーが発生しました:", error);
        alert("投稿に失敗しました: " + error.message);
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerText = "投稿する";
    }
});

// セキュリティ対策（文字化け・不正コード対策）
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}
