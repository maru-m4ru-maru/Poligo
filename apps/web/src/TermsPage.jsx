function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

const TERMS_SECTIONS = [
  {
    title: 'アカウントと登録情報',
    body: '登録情報は正確かつ最新の状態に保ってください。アカウントと認証情報の管理は利用者の責任です。原則として1人につき1アカウントとし、運営が認めた場合を除き、複数アカウントによる保存容量・実行回数・その他の制限回避を禁止します。未成年者は法定代理人の同意を得たうえで利用してください。'
  },
  {
    title: 'プロジェクトと知的財産権',
    body: '利用者は、自分が作成した、または利用する権利を持つコード、ファイル、説明、画像、コメント等のみを保存・公開してください。利用者が作成したコンテンツの権利は、法令に別段の定めがある場合を除き利用者に留保されます。サービスの保存、表示、バックアップ、公開設定に応じた配信に必要な範囲で、運営者に非独占的な利用を許諾するものとします。'
  },
  {
    title: '公開・非公開とコミュニティ',
    body: '公開したプロジェクト、説明、コメント等は他の利用者や一般の閲覧者が閲覧・複製できる場合があります。公開前に秘密情報、APIキー、パスワード、個人情報、第三者の権利を侵害する内容が含まれていないことを確認してください。非公開設定はサービス内部のアクセス制御を意味し、絶対的な秘密保持を保証するものではありません。'
  },
  {
    title: 'コード実行・AI機能',
    body: 'コード実行環境には、対応言語、実行時間、メモリ、ネットワーク、パッケージ利用等の制限が設けられる場合があります。安全性を確認できないコードや第三者から入手したコードを実行する際は、利用者自身で内容を確認してください。AI機能を利用した場合、入力した指示、選択したコード、プロジェクトの関連ファイル等がAI処理のため外部プロバイダーへ送信されることがあります。AIの出力は誤りを含む可能性があり、利用前に検証してください。'
  },
  {
    title: '禁止事項',
    body: '法令違反、権利侵害、不正アクセス、認証情報の窃取、マルウェアの配布、脆弱性や制限の悪用、他の利用者への嫌がらせ、過度な負荷、サービスの妨害、スパム、無許可の複数アカウント利用、およびその他運営が不適切と合理的に判断する行為を禁止します。脆弱性を発見した場合は、悪用やデータ取得をせず、運営へ安全に報告してください。'
  },
  {
    title: '利用停止・コンテンツの対応',
    body: '違反、セキュリティ上の危険、第三者からの権利侵害申立て、法令上の要請、またはサービス保全の必要がある場合、運営者は状況に応じて通知、公開停止、実行制限、アカウント停止、コンテンツ削除等の措置を行うことがあります。緊急時は事前通知なしに対応する場合があります。措置の範囲は違反の重大性や再発状況等を考慮します。'
  },
  {
    title: 'サービスの変更・停止とデータ',
    body: 'Poligoは開発・運用状況に応じて機能、保存容量、対応言語、制限、提供条件を変更し、保守、障害、安全上の理由等により一時停止または終了する場合があります。利用者は重要なデータのバックアップを保持してください。運営者は、法令上必要な場合を除き、常時の提供、無停止動作、データの完全な保存・復元を保証しません。'
  },
  {
    title: '免責と責任',
    body: '本サービスは現状有姿で提供されます。運営者は合理的な安全対策と安定運用に努めますが、完全性、正確性、特定目的への適合性、無停止性を保証しません。運営者の責任は適用法令が許す範囲に限られます。本規約は、法令により排除または制限できない責任や利用者の権利を制限するものではありません。'
  },
  {
    title: 'プライバシーと規約の変更',
    body: '個人情報等の取扱いはプライバシーポリシーに従います。規約を変更する場合、変更内容と適用開始日を本ページで案内します。重要な変更については、必要に応じて別途通知し、法令上必要な同意を取得します。変更後に適用開始日以降も利用を継続した場合、法令上認められる範囲で変更後の規約が適用されます。'
  }
]

export default function TermsPage() {
  return (
    <div className="terms-page legal-page">
      <header className="terms-nav">
        <button className="terms-brand" type="button" onClick={() => navigate('/')}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>
        <nav className="legal-nav-links" aria-label="ポリシー">
          <button type="button" className="is-current" onClick={() => navigate('/terms')}>利用規約</button>
          <button type="button" onClick={() => navigate('/privacy')}>プライバシーポリシー</button>
          <button type="button" onClick={() => navigate('/')}>ホームへ</button>
        </nav>
      </header>

      <main className="terms-main">
        <header className="terms-heading">
          <span className="home-eyebrow">POLIGO / TERMS</span>
          <h1>利用規約</h1>
          <p>Poligoを安心して利用するためのルールです。アカウント作成時には、利用規約とプライバシーポリシーへの明示的な同意が必要です。</p>
          <span className="terms-updated">最終更新日: 2026年10月16日</span>
        </header>

        <section className="terms-grid legal-grid">
          {TERMS_SECTIONS.map((section, index) => (
            <article className={'terms-card' + (index === 0 || index === 3 ? ' terms-card-emphasis' : '')} key={section.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="legal-bottom-note">
          <strong>関連文書</strong>
          <p>個人情報の取得・利用・保管・外部サービスでの処理については、<button type="button" onClick={() => navigate('/privacy')}>プライバシーポリシー</button>をご確認ください。</p>
        </section>
      </main>

      <footer className="terms-footer">
        <span>© Poligo</span>
        <nav className="legal-footer-links" aria-label="フッター">
          <button type="button" onClick={() => navigate('/')}>ホーム</button>
          <button type="button" onClick={() => navigate('/privacy')}>プライバシーポリシー</button>
        </nav>
      </footer>
    </div>
  )
}
