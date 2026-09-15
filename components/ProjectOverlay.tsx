"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { placeholders, type Project } from "@/data/content";

type ProjectOverlayProps = {
  project: Project | null;
  onClose: () => void;
};

export function ProjectOverlay({ project, onClose }: ProjectOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!project || !dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
      previousFocus?.focus();
    };
  }, [project]);

  if (!project) return null;

  return (
    <dialog
      ref={dialogRef}
      className="project-dialog"
      aria-labelledby="project-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <article className="project-detail">
        <button className="project-detail__close" onClick={onClose} aria-label="Close project details">
          <X aria-hidden="true" />
        </button>
        <div className="project-visual project-detail__visual" role="img"
          aria-label="Placeholder for the final project image">
          <span className="project-visual__label micro">{project.coverImage}</span>
        </div>
        <header className="project-detail__header">
          <span className="micro">PROJECT / {project.id}</span>
          <h2 id="project-dialog-title">{project.title}</h2>
          <p>{project.shortDescription}</p>
          <div className="project-detail__meta micro">
            <span>{project.categories.length ? project.categories.join(" + ") : placeholders.scienceCategory}</span>
            <span>{project.grade}</span>
            <span>{project.studentNames.join(", ")}</span>
          </div>
        </header>
        <div className="project-detail__story">
          {[
            ["01", "The question", project.question],
            ["02", "The idea", project.idea],
            ["03", "The experiment", project.experiment],
            ["04", "What we found", project.findings],
          ].map(([number, title, copy]) => (
            <section key={title}>
              <span className="micro">{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </section>
          ))}
        </div>
      </article>
    </dialog>
  );
}
