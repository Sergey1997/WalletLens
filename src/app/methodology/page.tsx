import { CHAINS } from "@/lib/chains";
import { listSnapshots } from "@/lib/lists";
import { METHODOLOGY_VERSION } from "@/lib/scoring/weights";

export const metadata = { title: "WalletLens · methodology" };

export default function Methodology() {
  const snapshots = listSnapshots();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 prose prose-slate">
      <h1>Methodology</h1>
      <p className="text-muted-foreground">
        Version <code>{METHODOLOGY_VERSION}</code>. Scoring is deterministic and auditable: every factor in a
        report has a weight, a source and a link to on-chain evidence.
      </p>

      <h2>Chains covered</h2>
      <ul>
        {CHAINS.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong> (chainId {c.id}) · {c.explorerName}
          </li>
        ))}
      </ul>

      <h2>Data sources</h2>
      <ul>
        <li>Etherscan V2 multichain API (normal tx, ERC-20 transfers, balance).</li>
        <li>Curated public lists bundled in the repository (see below).</li>
        <li>
          Future: 1–2 hop counterparty graph for indirect exposure; optional licensed risk oracle via{" "}
          <code>RiskDataProvider</code>.
        </li>
      </ul>

      <h2>Curated list snapshots</h2>
      <ul>
        {snapshots.map((s) => (
          <li key={s.source}>
            <strong>{s.source}</strong> — version <code>{s.version}</code> · {s.size} entries
          </li>
        ))}
      </ul>

      <h2>Scoring model</h2>
      <p>
        The <strong>headline wallet score</strong> is a single number from <strong>0 to 100</strong> where{" "}
        <strong>100 is the best</strong> score. It is derived as:{" "}
        <code>100 − (riskBurden × 1.5) + trustBoost</code>, where{" "}
        <code>trustBoost = (trustScore / 100) × 15</code>, with the result clamped to <code>[0, 100]</code>. The
        <code>×1.5</code> multiplier is intentional: each point of Risk burden subtracts more than one point from
        the headline so mid-range risk is meaningfully visible. Raw <code>trustScore</code> and{" "}
        <code>riskScore</code> are still shown for auditability.
      </p>
      <p>
        Under the hood, risk and trust are computed from separate signals. A wallet can be both well-attributed (trust)
        and exposed to negative counterparties (risk) — the headline score combines them for one comparable metric.
      </p>
      <ul>
        <li>
          <strong>Severe weight (100):</strong> address itself on OFAC SDN.
        </li>
        <li>
          <strong>High weight (55–90):</strong> direct interaction with a sanctioned address, mixer, exploit or
          community-flagged phishing/scam contract.
        </li>
        <li>
          <strong>Medium–Low (10–50):</strong> behavioural heuristics — burst activity on a very young wallet,
          disproportionate volume through unknown counterparties.
        </li>
        <li>
          <strong>Trust (+):</strong> wallet longevity (90d / 180d / 365d tiers), attributed CEX / DeFi / bridge
          counterparties, diverse counterparty graph.
        </li>
      </ul>

      <h2>Confidence</h2>
      <p>
        Confidence reflects <em>coverage</em>, not safety. Fewer than 10 observed transactions yields <code>low</code>{" "}
        confidence. A high wallet score + low confidence means &ldquo;looks clean in what we saw&rdquo;, not a guarantee.
      </p>

      <h2>Limitations</h2>
      <p>
        WalletLens is a transparent public-signal viewer. It does not publish accusations and is designed to be
        combined with, or upgraded toward, a licensed risk oracle (TRM, Chainalysis, Elliptic, Merkle Science) through
        the <code>RiskDataProvider</code> abstraction.
      </p>
    </main>
  );
}
