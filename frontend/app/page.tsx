import Link from "next/link";
import { RoomScene } from "@/components/RoomScene";
import { Stamp } from "@/components/Stamp";
import { Topbar } from "@/components/Topbar";

export default function Landing() {
  return (
    <>
      <Topbar landing />

      <section className="hero guilloche">
        <div className="wrap hero__grid">
          <div>
            <h1 className="hero__title">
              <span>Deposit wapas.</span>
              <span>Bina jhagde ke.</span>
            </h1>
            <p className="lede" style={{ marginTop: 22 }}>
              Record your room the day you move in. Your landlord signs off on WhatsApp. When you move out, Wapas
              compares both videos and shows what was already broken, and what&apos;s actually fair to deduct.
            </p>
            <div className="row hero__cta">
              <Link href="/property/new" className="btn btn--primary">
                Record my move-in
              </Link>
              <Link href="/verify" className="btn">
                Verify a video
              </Link>
            </div>
            <p className="hero__fine">Free for tenants. ₹149 when you move out.</p>
          </div>

          <div className="board" aria-label="Example verdicts from a move-out comparison">
            <div className="board__head">
              <span>Room 204, Shanti PG</span>
              <span>2 findings</span>
            </div>

            <div>
              <div className="pair">
                <figure className="photo">
                  <RoomScene variant="crack" />
                  <figcaption>
                    <span>Move-in</span>
                    <span className="muted">3 Jul</span>
                  </figcaption>
                </figure>
                <figure className="photo">
                  <RoomScene variant="crack" later />
                  <figcaption>
                    <span>Move-out</span>
                    <span className="muted">28 Mar</span>
                  </figcaption>
                </figure>
                <div className="pair__stamp">
                  <Stamp main="Pre-existing" sub="pehle se tha" tone="safe" rotate={-9} slam delay={0.5} />
                </div>
              </div>
              <div className="verdict__foot">
                <span className="small">Crack under the window. Landlord signed it at move-in.</span>
                <span className="verdict__cost verdict__cost--zero">₹0</span>
              </div>
            </div>

            <div>
              <div className="pair">
                <figure className="photo">
                  <RoomScene variant="stain" />
                  <figcaption>
                    <span>Move-in</span>
                    <span className="muted">3 Jul</span>
                  </figcaption>
                </figure>
                <figure className="photo">
                  <RoomScene variant="stain" later />
                  <figcaption>
                    <span>Move-out</span>
                    <span className="muted">28 Mar</span>
                  </figcaption>
                </figure>
                <div className="pair__stamp">
                  <Stamp main="New damage" sub="naya hai" tone="liable" rotate={7} slam delay={1.15} />
                </div>
              </div>
              <div className="verdict__foot">
                <span className="small">Stain beside the switchboard. Not in the move-in record.</span>
                <span className="verdict__cost">₹300–700</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <h2 className="section__title">How it works</h2>
          <div className="steps3">
            <div className="step3">
              <div className="step3__n">1</div>
              <h3>Record each room</h3>
              <p>
                Pan slowly and say what&apos;s broken, in Hindi or English. Wapas fingerprints the video the moment it
                uploads, so nobody can swap it later.
              </p>
            </div>
            <div className="step3">
              <div className="step3__n">2</div>
              <h3>Landlord signs on WhatsApp</h3>
              <p>
                They open a link, see every issue with its photo and timestamp, and tap Agree. No app, no login.
              </p>
            </div>
            <div className="step3">
              <div className="step3__n">3</div>
              <h3>Compare at move-out</h3>
              <p>
                Record the same rooms again. AI stamps every issue as pre-existing, worsened, new or fixed, with a fair
                repair cost from local rates.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--sheet">
        <div className="wrap wrap--narrow">
          <h2 className="section__title">Tenants lose deposits because they can&apos;t prove anything.</h2>
          <table className="ledger">
            <tbody>
              <tr>
                <td>Security deposits locked with landlords across six Indian cities.</td>
                <td className="ledger__amt">₹1.26 lakh cr</td>
              </tr>
              <tr>
                <td>Bengaluru tenants who gave up a home they liked because of the deposit.</td>
                <td className="ledger__amt">75%</td>
              </tr>
              <tr>
                <td>Chennai tenants who never got their deposit back.</td>
                <td className="ledger__amt">11%</td>
              </tr>
            </tbody>
          </table>
          <p className="source">NoBroker Rent Report 2026, as reported by RentOk in July 2026.</p>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <h2 className="section__title">Free to record. Pay only when you move out.</h2>
          <div className="slips">
            <div className="slip">
              <h3>Move-in record</h3>
              <div className="slip__price">₹0</div>
              <div className="muted">for every tenant</div>
              <ul>
                <li>Every room, with voice notes</li>
                <li>Landlord sign-off link</li>
                <li>Tamper check for each video</li>
              </ul>
            </div>
            <div className="slip slip--feature">
              <h3>Move-out pack</h3>
              <div className="slip__price">₹149</div>
              <div>one time, per move</div>
              <ul>
                <li>AI compare against your move-in</li>
                <li>Fair deduction from local repair rates</li>
                <li>Evidence report to send your landlord</li>
              </ul>
            </div>
            <div className="slip">
              <h3>PG &amp; co-living owners</h3>
              <div className="slip__price">₹15</div>
              <div className="muted">per bed, per month</div>
              <ul>
                <li>Check-in and check-out for every bed</li>
                <li>Charge real damage with proof</li>
                <li>Fewer deposit fights and bad reviews</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--sheet">
        <div className="wrap spread">
          <div>
            <h2>Got a Wapas report?</h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Drop the original video to check it matches the fingerprint taken on move-in day.
            </p>
          </div>
          <Link href="/verify" className="btn btn--ink">
            Verify a video
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap spread">
          <span>Wapas organises evidence. It isn&apos;t legal advice.</span>
          <span>Built by team 0xalgos for the Next Founders Hackathon, 2026.</span>
        </div>
      </footer>
    </>
  );
}
