# Name It First

名前を提案して、このサイトでまだ誰も提案していなければ「成功」、提案済みなら「失敗」と提案された回数を表示するサイトです。

- 公開先: https://nameit.kdking-tools.com/
- `main` に push すると GitHub Actions が `tools/build.js` で `_site/` を作り、GitHub Pages に公開します。手元で確かめるときは `node tools/build.js` を実行して `_site/` を開いてください。

## 仕組み
- 名前は入力どおりに比べます。前後の空白だけは取り除きますが、大文字と小文字、全角と半角は別の名前として扱います。長さは50文字までです。
- 訪問者ごとに Supabase の匿名ユーザーを作り、そのユーザーIDを端末として扱います。DB は `(名前, 端末)` を主キーにしているので、同じ端末から同じ名前を何度送っても1回しかカウントされません。
- 最初に提案した端末が同じ名前を送ると「あなたの名前のまま」と表示されます。
- 1端末あたり1分間に30回までしか提案できません。
- 言語は英語、ヒンディー語、スペイン語、ポルトガル語、フランス語、ドイツ語、日本語、中国語、アラビア語、インドネシア語、ロシア語です。ブラウザの言語に合わせて自動で選び、右上で切り替えられます。英語以外は `/ja/` `/es/` のように言語ごとのページがあり、タイトルや説明文がその言語になるので、各国の検索に載ります（サイトマップと hreflang もビルドで自動生成）。`?lang=hi` のように URL で指定することもできます。言語を増やすときは `i18n.js` にブロックを1つ足すだけで、ページも自動で増えます。

## ファイル

| ファイル | 中身 |
| --- | --- |
| `index.html` / `app.js` / `style.css` | トップ画面 |
| `i18n.js` | 各言語の文言 |
| `config.js` | Supabase の URL と anon キー、AdSense の ID（どれも公開してよい値） |
| `about.html` / `privacy.html` | サイトについて・プライバシーポリシー（AdSense の審査に必要） |
| `supabase/schema.sql` | テーブルと、提案を数える関数 |

## 公開の手順

1. **Supabase**：新しいプロジェクトを作ります（ハムとイガグリのプロジェクトに同居させても大丈夫です。テーブル名はすべて `nc_` で始まります）。
   - SQL Editor で `supabase/schema.sql` を実行します。
   - Authentication → Sign In / Providers で「Allow anonymous sign-ins」をオンにします。
   - Project Settings → API の Project URL と anon キーを `config.js` に書きます。
2. **GitHub Pages**：リポジトリの Settings → Pages で Source を「GitHub Actions」にします。
3. **DNS**：`kdking-tools.com` の DNS に CNAME レコード `nameit` → `kodaka-yutaro.github.io` を追加します。
4. Settings → Pages の Custom domain に `nameit.kdking-tools.com` を入力し、証明書の発行後に「Enforce HTTPS」をオンにします。

## 広告（Google AdSense）

1. AdSense の「サイト」に `kdking-tools.com` を追加して審査を申し込みます（サブドメインは親ドメインの承認でまとめて扱われます）。
2. 審査のための確認コード（`<meta name="google-adsense-account" ...>`）は `index.html` の `<head>` に入れます。
3. 承認されたら、`config.js` の `adsenseClient`（`ca-pub-...`）と `adsenseSlot`（広告ユニットの番号）を埋めます。広告は結果表示の下に出ます。
4. `ads.txt` は親ドメイン `kdking-tools.com/ads.txt` に置く必要があります。
5. EU・英国向けには、AdSense の「プライバシーとメッセージ」で同意メッセージ（CMP）をオンにします。
