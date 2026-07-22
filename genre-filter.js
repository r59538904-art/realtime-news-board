'use strict';
// ジャンル絞込プルダウン: キーワード検索ボックスの隣に置き、選択したジャンルに関連する
// キーワードを含む記事だけに絞り込む。配信元チップ・トピック絞込・検索語と同様、
// 「すべての条件を満たす記事だけを表示する」AND条件の1つとして働く(既存の絞り込みは
// そのままに、選択したジャンルでさらに絞り込む)。単語リストはgenre-keywords.jsに分離。

const GENRE_PREF_KEY = 'news-board-genre-pref-v1';
let selectedGenre = null;  // null = 「すべてのジャンル」(絞り込みなし)

// ジャンルごとの判定用正規表現を起動時に1回だけ作っておく
GENRES.forEach(genre => { genre.re = buildKeywordRe(genre.cjk, genre.latin, 'i'); });

function loadGenrePref(){
  const saved = storageGet(GENRE_PREF_KEY);
  selectedGenre = GENRES.some(genre => genre.id === saved) ? saved : null;
}

function buildGenreSelect(){
  const selectEl = document.getElementById('genreSelect');
  selectEl.textContent = '';

  const allOption = el('option', null, 'すべてのジャンル');
  allOption.value = '';
  selectEl.appendChild(allOption);

  GENRES.forEach(genre => {
    const option = el('option', null, genre.label);
    option.value = genre.id;
    selectEl.appendChild(option);
  });

  selectEl.value = selectedGenre || '';
}

// タイトル+要約(原文・翻訳文の両方)のどこかに該当ジャンルのキーワードがあれば通す
function matchesGenre(item){
  if(!selectedGenre) return true;
  const genre = GENRES.find(g => g.id === selectedGenre);
  return !!genre && genre.re.test(keywordSearchText(item));
}
