function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const PRIVACY_SECTIONS = [
  {
    title: '1. 適用範囲と運営者',
    body: 'このポリシーはPoligoのウェブサイト、IDE、プロジェクト保存、コード実行、コミュニティ、AI支援等の機能に適用されます。以下「運営者」とはPoligoを管理・運営する者をいいます。'
  },
  {
    title: '2. 取得する情報',
    body: 'アカウント作成時の表示名、ユーザー名、メールアドレス、認証に必要な情報、同意した規約のバージョンと同意日時を取り扱います。また、プロジェクト名、ソースファイル、説明、ソース履歴、公開設定、コメント、スター、お気に入り、フォーク等、利用者が保存・投稿した情報を取り扱います。'
  },
  {
    title: '3. 技術情報と利用ログ',
    body: 'セッションを維持し、不正利用を防ぎ、障害を調査するため、セッション識別子、接続元IPアドレス、ブラウザー情報、リクエスト情報、実行結果、エラーや運用ログ等を必要な範囲で取り扱う場合があります。ログの種類や保持期間は障害対応、安全対策、法令上の要請等により異なります。'
  },
  {
    title: '4. 利用目的',
    body: '取得情報は、アカウント認証、プロジェクトの保存・同期・復元、公開設定に応じた作品表示、スターやコメント等のコミュニティ機能、コード実行、AI機能の提供、問い合わせ対応、障害対応、不正利用の検知・調査、サービス改善および法令への対応のために利用します。公表した目的を超えて利用する場合は、法令に従って必要な対応を行います。'
  },
  {
    title: '5. AI機能とコード実行',
    body: 'AI機能を利用すると、利用者が送信した指示、選択中のコード、プロジェクト名、AIの回答に必要な関連ファイルの内容等がOpenRouterおよび選択されたAIモデル提供者へ送信され、処理されます。環境変数や秘密情報ファイル等、一部の情報は送信対象から除外する対策を設けていますが、完全な検出を保証するものではありません。AIに送る前に、パスワード、APIキー、個人情報、機密コードを削除してください。コード実行では、実行に必要なコードや入力が実行基盤に送信されます。'
  },
  {
    title: '6. 保存・処理を委託するサービス',
    body: 'サービス運用のため、ホスティング・デプロイ（Render）、認証・プロジェクトデータベース（Turso/libSQL）、コミュニティデータベース（CockroachDB等、実際の環境設定に応じる）、コード実行基盤、AIルーティング・モデル提供者等の外部サービスを利用する場合があります。各サービスには、機能提供に必要な情報が送信・保存されることがあります。外部サービスの処理地域や保存先は各サービスの設定・運用により異なり、日本国外で処理される場合があります。'
  },
  {
    title: '7. 第三者提供',
    body: '運営者は、法令に基づく場合、生命・身体・財産の保護に必要で同意取得が困難な場合、不正利用やセキュリティ事故への対処に必要な場合、利用者が公開・送信を選択した場合、または適法な委託に伴う場合等を除き、本人の同意なく個人データを第三者へ提供しません。委託先にはサービス提供に必要な範囲で情報を取り扱わせます。'
  },
  {
    title: '8. 公開情報',
    body: 'コミュニティに公開したプロジェクト、コメント、説明等は、他の利用者やインターネット上の閲覧者に表示されることがあります。公開後に非公開へ変更しても、第三者が保存したコピー、外部キャッシュ、引用等まで回収・削除できるとは限りません。個人情報や秘密情報を公開プロジェクトに含めないでください。'
  },
  {
    title: '9. 保管期間と削除',
    body: '情報は利用目的の達成に必要な期間、アカウントの利用期間、セキュリティ対応、バックアップ、紛争対応、法令上必要な期間等に応じて保管します。アカウント削除や削除の申し出を受けた場合は、法令上の保存義務や不正防止・バックアップ等に必要な範囲を除き、合理的な期間内に削除または個人を識別できない形にします。バックアップやログから直ちに消去されない場合があります。'
  },
  {
    title: '10. 安全管理',
    body: '不正アクセス、紛失、漏えい、改ざん等を防ぐため、アクセス制御、認証、権限管理、運用ログ、必要な更新等の合理的な対策を講じます。ただし、インターネット上の送受信や情報システムに完全な安全性を保証することはできません。事故が発生した場合は、法令等に従って必要な調査・報告・本人への通知等を行います。'
  },
  {
    title: '11. 利用者からの請求・問い合わせ',
    body: '利用者は、適用法令に従い、自身の情報の開示、訂正、利用停止、削除等を申し出ることができます。本人確認や対象情報の特定に必要な情報をお願いする場合があります。お問い合わせの際は、公開されるコミュニティ投稿や公開GitHub Issue等にパスワード、メールアドレス、その他の個人情報を記載しないでください。運営者への連絡方法はPoligoの公式リポジトリに掲載される案内を確認してください。'
  },
  {
    title: '12. 改定',
    body: 'サービスの変更、利用する外部サービス、法令等に応じて本ポリシーを改定することがあります。重要な変更がある場合は、本ページ等で内容と適用開始日を案内し、法令上必要な場合は同意を取得します。'
  }
]

export default function PrivacyPolicyPage() {
  return (
    <div className="terms-page legal-page privacy-page">
      <header className="terms-nav">
        <button className="terms-brand" type="button" onClick={() => navigate('/')}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>
        <nav className="legal-nav-links" aria-label="ポリシー">
          <button type="button" onClick={() => navigate('/terms')}>利用規約</button>
          <button type="button" className="is-current" onClick={() => navigate('/privacy')}>プライバシーポリシー</button>
          <button type="button" onClick={() => navigate('/')}>ホームへ</button>
        </nav>
      </header>

      <main className="terms-main">
        <header className="terms-heading">
          <span className="home-eyebrow">POLIGO / PRIVACY</span>
          <h1>プライバシーポリシー</h1>
          <p>Poligoで扱うアカウント情報、プロジェクト、コード実行、AI機能のデータについて説明します。</p>
          <span className="terms-updated">最終更新日: 2026年10月16日</span>
        </header>

        <section className="terms-grid legal-grid">
          {PRIVACY_SECTIONS.map((section, index) => (
            <article className={'terms-card' + (index === 0 || index === 4 ? ' terms-card-emphasis' : '')} key={section.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="legal-bottom-note">
          <strong>関連文書</strong>
          <p>アカウント作成に必要な利用条件は、<button type="button" onClick={() => navigate('/terms')}>利用規約</button>をご確認ください。</p>
        </section>
      </main>

      <footer className="terms-footer">
        <span>© Poligo</span>
        <nav className="legal-footer-links" aria-label="フッター">
          <button type="button" onClick={() => navigate('/')}>ホーム</button>
          <button type="button" onClick={() => navigate('/terms')}>利用規約</button>
        </nav>
      </footer>
    </div>
  )
}
