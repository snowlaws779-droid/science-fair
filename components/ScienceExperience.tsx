"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowDown, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { eventConfig, placeholders, projects, scienceCategories, type Project, type ScienceCategory } from "@/data/content";
import { ProjectOverlay } from "./ProjectOverlay";

const ScienceWorld = dynamic(() => import("./ScienceWorld").then((module) => module.ScienceWorld), {
  ssr: false,
  loading: () => <div className="world-fallback" aria-hidden="true" />,
});

function dispatchField(index: number) {
  window.dispatchEvent(new CustomEvent("science-field", { detail: index }));
}

export function ScienceExperience() {
  const [loaded, setLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"ALL" | ScienceCategory>("ALL");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const filteredProjects = useMemo(
    () => activeFilter === "ALL" ? projects : projects.filter((project) => project.categories.includes(activeFilter)),
    [activeFilter],
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const returning = window.sessionStorage.getItem("science-week-viewed") === "1";
    const minimum = reduced ? 40 : returning ? 260 : 780;
    let cancelled = false;
    const ready = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      new Promise<void>((resolve) => window.setTimeout(resolve, minimum)),
    ]);
    ready.then(() => {
      if (!cancelled) {
        setLoaded(true);
        window.sessionStorage.setItem("science-week-viewed", "1");
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
    const update = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.fromTo(element, { yPercent: 16, opacity: 0 }, {
          yPercent: 0,
          opacity: 1,
          duration: 1.1,
          ease: "power4.out",
          scrollTrigger: { trigger: element, start: "top 84%", once: true },
        });
      });
      const heroTimeline = gsap.timeline({
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1.15 },
      });
      heroTimeline
        .to(".hero__word--science", { xPercent: -19, yPercent: -18, scale: .9, opacity: .18, ease: "none" }, 0)
        .to(".hero__word--week", { xPercent: 19, yPercent: 22, scale: 1.09, opacity: .12, ease: "none" }, 0)
        .to(".hero__copy", { yPercent: -90, opacity: 0, ease: "none" }, 0)
        .to(".hero__cta, .hero__scroll", { yPercent: 45, opacity: 0, ease: "none" }, 0);

      gsap.utils.toArray<HTMLElement>(".chapter").forEach((chapter) => {
        const title = chapter.querySelector("h2");
        if (title) {
          gsap.fromTo(title, { clipPath: "inset(0 0 100% 0)", yPercent: 14 }, {
            clipPath: "inset(0 0 0% 0)", yPercent: 0, ease: "power4.out", duration: 1.25,
            scrollTrigger: { trigger: title, start: "top 88%", once: true },
          });
        }
        const index = chapter.querySelector(".chapter-index");
        if (index) {
          gsap.fromTo(index, { yPercent: 75, opacity: .25 }, {
            yPercent: -75, opacity: 1, ease: "none",
            scrollTrigger: { trigger: chapter, start: "top bottom", end: "bottom top", scrub: 1.4 },
          });
        }
      });

      gsap.utils.toArray<HTMLElement>(".project-visual, .visit__frame").forEach((visual) => {
        gsap.fromTo(visual, { backgroundPosition: "50% 35%" }, {
          backgroundPosition: "50% 65%", ease: "none",
          scrollTrigger: { trigger: visual, start: "top bottom", end: "bottom top", scrub: 1.2 },
        });
      });
    });

    return () => {
      context.revert();
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  return (
    <main className="experience">
      <ScienceWorld />

      <div className={`loader ${loaded ? "loader--done" : ""}`} aria-hidden={loaded}>
        <div className="loader__top micro"><span>FIELD / 01</span><span>AMBASSADOR SCHOOL</span></div>
        <div className="loader__status micro">EXHIBITION / INITIALISING</div>
        <div className="loader__count">100<span>%</span></div>
        <div className="loader__line" />
      </div>

      <header className={`site-header ${loaded ? "is-visible" : ""}`}>
        <a href="#top" className="brand" aria-label="Ambassador School Science Week home">
          <span className="brand__plate">
            <Image src="/ambassador-lockup-cropped.png" width={135} height={104}
              alt="Ambassador School official logo" priority />
          </span>
          <span className="brand__compact">
            <Image src="/ambassador-mark-transparent.png" width={56} height={34} alt="" priority />
          </span>
          <span className="brand__text">
            <span className="brand__school">AMBASSADOR SCHOOL</span>
            <span>SCIENCE WEEK <b>/ {eventConfig.year}</b></span>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          {eventConfig.navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
        </nav>
        <a className="menu-link" href="#projects">EXPLORE <ArrowDownRight size={14} aria-hidden="true" /></a>
      </header>

      <section id="top" className={`hero ${loaded ? "is-visible" : ""}`} aria-labelledby="hero-title">
        <div className="hero__eyebrow micro">AMBASSADOR SCHOOL / SCIENCE WEEK</div>
        <h1 id="hero-title" className="hero__title" aria-label="Science Week">
          <span className="hero__word hero__word--science"><i>SCIENCE</i></span>
          <span className="hero__word hero__word--week"><i>WEEK</i></span>
        </h1>
        <p className="hero__copy">{eventConfig.introduction}</p>
        <a className="hero__cta" href="#projects"><span>Explore the gallery</span><ArrowDown size={16} aria-hidden="true" /></a>
        <div className="hero__scroll micro">SCROLL TO DISCOVER</div>
      </section>

      <section id="about" className="manifesto chapter" aria-labelledby="manifesto-title">
        <span className="chapter-index micro">02 / INTRODUCTION</span>
        <div className="manifesto__aside micro" data-reveal>SCIENCE WEEK / INTRODUCTION</div>
        <h2 id="manifesto-title" data-reveal>Science Week<br /><em>introduction.</em></h2>
        <p data-reveal>{eventConfig.introduction}</p>
        <div className="manifesto__stats">
          {eventConfig.highlights.map((item, index) => (
            <div key={index} data-reveal><strong className={item.value.startsWith("[") ? "is-placeholder" : ""}>{item.value}</strong><span className="micro">{item.label}</span></div>
          ))}
        </div>
      </section>

      <section className="process chapter" aria-labelledby="process-title">
        <span className="chapter-index micro">03 / THE PROCESS</span>
        <header className="section-heading" data-reveal>
          <span className="micro">SCIENCE WEEK / PROCESS</span>
          <h2 id="process-title">The <em>process.</em></h2>
        </header>
        <div className="process__steps">
          {eventConfig.processSteps.map((step) => (
            <article key={step.id} data-reveal>
              <span className="process__number">{step.id}</span>
              <div><h3>{step.title}</h3><p>{step.description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="featured chapter" aria-labelledby="featured-title">
        <span className="chapter-index micro">04 / FEATURED PROJECTS</span>
        <header className="section-heading section-heading--split" data-reveal>
          <h2 id="featured-title">Featured<br /><em>projects.</em></h2>
          <p>{eventConfig.featuredDescription}</p>
        </header>
        <div className="featured__rail">
          {projects.slice(0, 3).map((project, index) => (
            <button className="featured-card" key={project.id} onClick={() => setActiveProject(project)} data-reveal>
              <div className="project-visual" role="img" aria-label="Placeholder for the final project image">
                <span className="project-visual__label micro">{project.coverImage}</span>
              </div>
              <div className="featured-card__meta micro"><span>{project.id} / {projects.length.toString().padStart(2, "0")}</span><span>{project.categories[0] ?? placeholders.scienceCategory}</span></div>
              <h3>{project.title}</h3>
              <ArrowUpRight aria-hidden="true" />
              <span className="sr-only">Open project details</span>
            </button>
          ))}
        </div>
      </section>

      <section id="projects" className="gallery chapter" aria-labelledby="gallery-title">
        <span className="chapter-index micro">05 / PROJECT GALLERY</span>
        <header className="section-heading section-heading--split" data-reveal>
          <h2 id="gallery-title">Project<br /><em>gallery.</em></h2>
          <p>{eventConfig.galleryDescription}</p>
        </header>
        <div className="filters" role="group" aria-label="Filter projects by science field" data-reveal>
          {(["ALL", ...scienceCategories] as const).map((category) => (
            <button key={category} className={activeFilter === category ? "is-active" : ""} onClick={() => setActiveFilter(category)} aria-pressed={activeFilter === category}>
              {category}
            </button>
          ))}
        </div>
        <div className="project-grid" aria-live="polite">
          {filteredProjects.map((project) => (
            <button className="project-card" key={project.id} onClick={() => setActiveProject(project)}>
              <div className="project-visual" role="img" aria-label="Placeholder for the final project image">
                <span className="project-visual__label micro">{project.coverImage}</span>
              </div>
              <div className="project-card__top micro"><span>{project.id} / {projects.length.toString().padStart(2, "0")}</span><span>{project.grade}</span></div>
              <h3>{project.title}</h3>
              <p>{project.categories.length ? project.categories.join(" + ") : placeholders.scienceCategory}</p>
              <span className="project-card__open micro">OPEN PROJECT ↗</span>
            </button>
          ))}
          {filteredProjects.length === 0 && (
            <p className="project-grid__empty">{placeholders.filteredProjects}</p>
          )}
        </div>
      </section>

      <section id="fields" className="fields chapter" aria-labelledby="fields-title">
        <span className="chapter-index micro">07 / SCIENCE FIELDS</span>
        <header className="section-heading" data-reveal>
          <span className="micro">SCIENCE WEEK / FIELDS</span>
          <h2 id="fields-title">Science<br /><em>fields.</em></h2>
        </header>
        <div className="fields__list">
          {scienceCategories.map((field, index) => (
            <button key={field} type="button" onPointerEnter={() => dispatchField(index)}
              onFocus={() => dispatchField(index)}
              onClick={() => {
                setActiveFilter(field);
                document.querySelector("#projects")?.scrollIntoView({ behavior: "smooth" });
              }} aria-label={`View ${field.toLowerCase()} projects`} data-reveal>
              <span className="micro">0{index + 1}</span><h3>{field}</h3><p>{eventConfig.fieldDescription}</p><ArrowUpRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="expect chapter" aria-labelledby="expect-title">
        <span className="chapter-index micro">08 / WHAT TO EXPECT</span>
        <h2 id="expect-title" data-reveal>What to<br /><em>expect.</em></h2>
        <div className="expect__ticker" aria-label="Event highlights">
          {eventConfig.exhibits.map((item, index) => (
            <div key={index} data-reveal><span className="micro">0{index + 1}</span><strong>{item}</strong></div>
          ))}
        </div>
      </section>

      <section id="visit" className="visit chapter" aria-labelledby="visit-title">
        <span className="chapter-index micro">09 / EVENT EXPERIENCE</span>
        <div className="visit__frame" data-reveal>
          <span className="visit__media-label micro">{eventConfig.exhibitMedia}</span>
        </div>
        <div className="visit__copy" data-reveal>
          <h2 id="visit-title">Event<br /><em>details.</em></h2>
          <p>{eventConfig.description}</p>
          <dl className="micro"><div><dt>WHEN</dt><dd>{eventConfig.dates}</dd></div><div><dt>WHERE</dt><dd>{eventConfig.location}</dd></div></dl>
        </div>
      </section>

      <section className="finale chapter" aria-labelledby="finale-title">
        <span className="chapter-index micro">10 / FINALE</span>
        <p className="micro" data-reveal>AMBASSADOR SCHOOL / SCIENCE WEEK {eventConfig.year}</p>
        <h2 id="finale-title" data-reveal><span>SCIENCE</span><em>WEEK.</em></h2>
        <a href="#top" className="finale__back micro">BACK TO THE BEGINNING ↑</a>
      </section>

      <footer className="footer">
        <div className="footer__top">
          <span className="footer__logo"><Image src="/ambassador-lockup-cropped.png"
            width={135} height={104} alt="Ambassador School official logo" /></span>
          <div className="footer__links">
            {eventConfig.navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
          </div>
        </div>
        <div className="footer__statement" aria-label="Science Week"><span>SCIENCE</span><span>WEEK.</span></div>
        <div className="footer__bottom micro"><span>AMBASSADOR SCHOOL</span><span>SCIENCE WEEK / {eventConfig.year}</span></div>
      </footer>

      <ProjectOverlay project={activeProject} onClose={() => setActiveProject(null)} />
    </main>
  );
}
