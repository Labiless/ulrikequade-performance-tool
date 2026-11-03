import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BrandHeader from "@/app/BrandHeader";
import styles from "./tutorial.module.css";

export const metadata: Metadata = {
  title: "How to use · Performance Tool · Ulrike Quade Company",
};

const SECTIONS = [
  { id: "overview", title: "What the tool does" },
  { id: "prepare", title: "1. Before the performance" },
  { id: "camera", title: "2. Set up the camera" },
  { id: "start", title: "3. Start the show" },
  { id: "during", title: "4. During the show" },
  { id: "stop", title: "5. Stop the show" },
  { id: "report", title: "6. Sync the video and read the report" },
  { id: "troubleshooting", title: "Troubleshooting" },
];

export default function TutorialPage() {
  return (
    <main className={styles.page}>
      <BrandHeader />

      <p className={styles.back}>
        <Link href="/">← All shows</Link>
      </p>

      <h1 className={styles.title}>How to use the tool</h1>
      <p className={styles.lead}>
        A step-by-step guide to mapping the moments when the audience perceives life on stage, from creating a show to
        watching the clicks on top of the video.
      </p>

      <nav className={styles.toc} aria-label="Contents">
        <ol>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <section id="overview" className={styles.section}>
        <h2>What the tool does</h2>
        <p>
          Every audience member scans a QR code and gets a page with a single round button. Whenever they perceive life
          on stage, they tap it. Each tap is saved with the exact moment it happened.
        </p>
        <p>
          The performance is filmed. Afterwards, the report page shows the video with a chart of the taps on top: the
          higher the line, the more people tapped at that moment.
        </p>
        <p>There are three screens:</p>
        <ul>
          <li>
            <strong>Control room</strong> – on the device the crew uses to start and stop the show. It also shows the
            QR code and how many people have joined.
          </li>
          <li>
            <strong>Audience page</strong> – the button, on the audience&apos;s phones.
          </li>
          <li>
            <strong>Click timeline</strong> – the report, with the video and the chart.
          </li>
        </ul>
      </section>

      <section id="prepare" className={styles.section}>
        <h2>1. Before the performance</h2>
        <ol className={styles.steps}>
          <li>
            On the <Link href="/">home page</Link>, click <Kbd>+ New show</Kbd>, give the show a name (for example the
            city and date) and confirm. Create a new show for every performance: each one has its own QR code and its
            own data.
            <Shot src="01-home.png" w={1280} h={560} caption="The home page: the list of shows and the New show button." />
            <Shot src="02-new-show.png" w={1280} h={800} caption="Give the new show a name and confirm." />
          </li>
          <li>
            You land in the <strong>control room</strong>. Keep this page open on the device that will stay with the
            crew during the show (a laptop or tablet).
            <Shot
              src="03-control-room.png"
              w={1280}
              h={800}
              caption="The control room before the show: the Start button, the people-joined counter, the QR code and the link to share."
            />
          </li>
          <li>
            Show the QR code to the audience. Click the QR code to open it full size in a new tab – useful on a second
            screen or a projector before the performance. The link under the QR code can be copied and shared too.
            <Shot src="04-qr.png" w={1280} h={800} caption="The QR code full size, ready for a second screen or a projector." />
          </li>
          <li>
            Watch the <strong>people joined</strong> counter go up as phones scan the code. People who arrive late can
            still scan it during the show.
            <PhoneShot
              src="05-audience-waiting.png"
              caption="What the audience sees after scanning: the button is off until the show starts."
            />
          </li>
        </ol>
        <Note>
          The audience&apos;s phones must be able to reach the tool. When testing on a computer, phones must be on the
          same Wi-Fi network; the QR code automatically uses the computer&apos;s network address.
        </Note>
      </section>

      <section id="camera" className={styles.section}>
        <h2>2. Set up the camera</h2>
        <p>Film with the phone&apos;s normal camera app (or an app with manual controls).</p>
        <ul>
          <li>Use a tripod, keep the phone plugged in, and turn on Do Not Disturb or airplane mode.</li>
          <li>Use a fixed frame rate (25 or 30 fps) and check there is enough free storage.</li>
          <li>
            <strong>Start recording before you press Start</strong>, and make sure the control-room screen is in the
            shot when the countdown ends. Press <Kbd>Full screen</Kbd> in the control room so the screen is easy to see.
          </li>
        </ul>
        <Note>
          When the countdown reaches zero, the whole control-room screen flashes white for a moment. That flash is the
          exact start of the show: later you will look for it in the video to line up the clicks.
        </Note>
      </section>

      <section id="start" className={styles.section}>
        <h2>3. Start the show</h2>
        <ol className={styles.steps}>
          <li>
            Wait until the Start button is enabled (while it says <em>Syncing…</em> the device is aligning its clock
            with the server).
          </li>
          <li>
            Press <Kbd>Start</Kbd>. A 3-2-1 countdown begins, then the screen flashes white and the stopwatch starts.
            <Shot src="06-countdown.png" w={1280} h={800} caption="The countdown after pressing Start." />
          </li>
          <li>At the same moment, the round button on every audience phone becomes active.</li>
        </ol>
        <p>
          The control room shows the show duration, the server time and the stop button. If the page is reloaded by
          mistake, the stopwatch resumes from the right point: the start is saved.
        </p>
        <Shot
          src="08-running.png"
          w={1280}
          h={800}
          caption="During the show: show duration, server time and the Stop button."
        />
      </section>

      <section id="during" className={styles.section}>
        <h2>4. During the show</h2>
        <ul>
          <li>The audience taps the circle whenever they perceive life on stage. A soft ripple confirms each tap.</li>
          <li>The audience page is dark and dim, so phones don&apos;t light up the auditorium.</li>
          <li>
            If a phone loses the network, its taps are kept on the phone and sent as soon as the connection comes back,
            with the original time of the tap.
          </li>
          <li>Each phone is counted once, even if the page is reloaded.</li>
        </ul>
        <PhoneShot src="07-audience-active.png" caption="An audience phone during the show, right after a tap." />
      </section>

      <section id="stop" className={styles.section}>
        <h2>5. Stop the show</h2>
        <ol className={styles.steps}>
          <li>
            At the end of the performance press <Kbd>Stop</Kbd> and confirm.{" "}
            <strong>A stopped show cannot be restarted.</strong>
          </li>
          <li>
            The buttons on the audience phones turn off and show a thank-you message.
            <PhoneShot src="09-audience-ended.png" caption="The audience page after the show has been stopped." />
          </li>
          <li>You are taken straight to the click timeline of the show.</li>
        </ol>
      </section>

      <section id="report" className={styles.section}>
        <h2>6. Sync the video and read the report</h2>
        <h3>Load and sync the video</h3>
        <ol className={styles.steps}>
          <li>
            Open the show&apos;s <strong>Click timeline</strong> (from the home page or after stopping the show).
          </li>
          <li>
            Click <Kbd>Choose video…</Kbd> and pick the recording. The video is not uploaded anywhere: it plays from
            your computer.
          </li>
          <li>
            Find the <strong>white flash</strong> at the start of the show:
            <ul>
              <li>drag left or right on the video to scrub;</li>
              <li>hold Shift while dragging for fine movement;</li>
              <li>
                use the slider to jump, and <Kbd>−1 fr</Kbd> / <Kbd>+1 fr</Kbd> (or the ← / → keys) to move one frame
                at a time; with Shift the keys move one second.
              </li>
            </ul>
          </li>
          <li>
            Stop on the first white frame and press <Kbd>Confirm show start</Kbd> (or Enter). The chart appears, lined
            up with the video.
            <Shot
              src="10-report-sync.png"
              w={1280}
              h={789}
              caption="Sync mode, stopped on the white flash. The time shows exactly where you are in the video."
            />
          </li>
        </ol>
        <p>
          The sync is remembered on this computer: if you load the same video file again, it is lined up automatically.
          Use <Kbd>Re-sync video</Kbd> to search again, or adjust the <em>Show start at video second</em> field by hand.
        </p>

        <h3>Read the chart</h3>
        <ul>
          <li>The horizontal axis is the time of the video; the vertical axis is the number of taps.</li>
          <li>
            <strong>Interval</strong> sets how taps are grouped (1 to 30 seconds). Short intervals show precise moments;
            long intervals show the overall shape of the performance.
          </li>
          <li>
            Hover over the chart to see how many taps and how many different people there were in that interval, and
            what share of the audience that is.
          </li>
          <li>Click anywhere on the chart to jump the video to that moment. The marker with a triangle shows where the video is.</li>
          <li>
            <strong>Data table</strong>, below the video, lists every interval with at least one tap.
          </li>
        </ul>
        <Shot
          src="11-report-chart.png"
          w={1280}
          h={789}
          caption="The synced report: hovering a peak shows the taps and the share of the audience in that interval."
        />
      </section>

      <section id="troubleshooting" className={styles.section}>
        <h2>Troubleshooting</h2>
        <dl className={styles.faq}>
          <dt>Phones can&apos;t open the QR code link</dt>
          <dd>
            Check that the phones are on the same network as the tool (when testing locally) and that the link under
            the QR code doesn&apos;t say <code>localhost</code>. Reload the control room after changing network: the
            address may have changed.
          </dd>

          <dt>The Start button stays on “Syncing…”</dt>
          <dd>The device can&apos;t reach the server. Check its internet connection and reload the page.</dd>

          <dt>An audience phone says “Connection failed”</dt>
          <dd>Ask the person to reload the page. Their taps are not lost while the page is open.</dd>

          <dt>The chart doesn&apos;t line up with the video</dt>
          <dd>
            Press <Kbd>Re-sync video</Kbd> and look for the flash again, frame by frame. If the flash isn&apos;t in the
            shot, enter the moment of the start by hand in <em>Show start at video second</em>.
          </dd>

          <dt>Some clicks are “outside the video”</dt>
          <dd>The recording started after the show began or ended before it finished; those taps can&apos;t be placed on the video.</dd>
        </dl>
      </section>
    </main>
  );
}

function Shot({ src, w, h, caption }: { src: string; w: number; h: number; caption: string }) {
  return (
    <figure className={styles.figure}>
      <Image
        src={`/tutorial/${src}`}
        alt={caption}
        width={w}
        height={h}
        className={styles.image}
        sizes="(max-width: 760px) 100vw, 728px"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function PhoneShot({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className={`${styles.figure} ${styles.phone}`}>
      <Image src={`/tutorial/${src}`} alt={caption} width={780} height={1688} className={styles.image} sizes="240px" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <span className={styles.kbd}>{children}</span>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.note}>
      <strong>Note</strong> {children}
    </p>
  );
}
