function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function TermsPage() {
  return (
    <div className="terms-page">
      <header className="terms-nav">
        <button className="terms-brand" onClick={() => navigate('/')}>
          <img src="/poligo-logo.svg" alt="Poligo" />
        </button>
        <button className="terms-home-button" onClick={() => navigate('/')}>
          Back to home
        </button>
      </header>

      <main className="terms-main">
        <header className="terms-heading">
          <span className="home-eyebrow">POLIGO TERMS</span>
          <h1>利用規約</h1>
          <p>
            Poligoをご利用いただく前に、以下の規約をご確認ください。
            本サービスを利用した場合、本規約に同意したものとみなします。
          </p>
          <span className="terms-updated">最終更新日: 2026年10月6日</span>
        </header>

        <section className="terms-grid">
          <article className="terms-card terms-card-emphasis">
            <span>01</span>
            <h2>アカウント</h2>
            <p>
              原則として、1人につき1つのアカウントのみ利用できます。
              運営者から明示的な許可を受けずに、複数のアカウントを作成・利用することを禁止します。
            </p>
          </article>

          <article className="terms-card">
            <span>02</span>
            <h2>複数アカウントによる制限回避</h2>
            <p>
              複数アカウントを利用して、保存容量、利用制限、その他のサービス上の制限を回避する行為も禁止します。
            </p>
          </article>

          <article className="terms-card terms-card-emphasis">
            <span>03</span>
            <h2>重大な違反への対応</h2>
            <p>
              無許可の複数アカウント利用が確認された場合、運営者は予告なく、該当アカウントおよび関連アカウントの停止、アクセス制限、削除その他必要な措置を行います。
            </p>
            <strong>
              また、同一人物による違反が確認された場合、その人物および関連アカウントについて、
              Poligoに限らず、運営者が提供・運営するすべてのサービスへのアクセスおよび利用を永久に禁止する場合があります。
            </strong>
          </article>

          <article className="terms-card">
            <span>04</span>
            <h2>保存容量</h2>
            <p>
              通常、1ユーザーあたり15MBの保存容量を利用できます。
              追加容量が必要な場合は運営者へ相談できますが、提供の可否および容量は利用状況等を考慮して運営者が判断します。
            </p>
          </article>

          <article className="terms-card">
            <span>05</span>
            <h2>禁止事項</h2>
            <p>
              不正アクセス、他ユーザーのアカウントの不正利用、本サービスへの過度な負荷、
              脆弱性の悪用、制限の回避、本サービスの正常な運営を妨害する行為、
              その他法令または公序良俗に反する行為を禁止します。
            </p>
          </article>

          <article className="terms-card">
            <span>06</span>
            <h2>利用停止・削除</h2>
            <p>
              本規約への違反が確認された場合、運営者は事前の通知なく、
              利用停止、永久的なアクセス制限、データ削除、アカウント削除、
              および運営者が提供・運営するすべてのサービスからの利用禁止を行うことができます。
            </p>
          </article>

          <article className="terms-card">
            <span>07</span>
            <h2>サービス提供</h2>
            <p>
              メンテナンス、障害、その他の事情により、本サービスの全部または一部を利用できない場合があります。
              運営者は必要に応じて本規約を変更し、変更後の規約を本ページで公開します。
            </p>
          </article>

          <article className="terms-card">
            <span>08</span>
            <h2>免責</h2>
            <p>
              運営者は可能な限り安定したサービス提供に努めますが、
              法令上認められる範囲で、本サービスの利用によって生じた損害について責任を負わないものとします。
            </p>
          </article>
        </section>
      </main>

      <footer className="terms-footer">
        <span>© Poligo</span>
        <button onClick={() => navigate('/')}>Home</button>
      </footer>
    </div>
  )
}
