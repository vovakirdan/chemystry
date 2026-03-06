import type {
  LaunchValidationModel,
  LaunchValidationSeverity,
} from "../validation/launchValidation";

type LaunchValidationCardProps = {
  model: LaunchValidationModel;
};

function launchValidationSeverityLabel(severity: LaunchValidationSeverity): string {
  return severity === "error" ? "Error" : "Warning";
}

export default function LaunchValidationCard({ model }: LaunchValidationCardProps) {
  return (
    <section
      id="pre-run-validation"
      className={`content-card launch-validation-card${model.hasErrors ? " launch-validation-card--blocked" : model.hasWarnings ? " launch-validation-card--warning" : " launch-validation-card--ready"}`}
      aria-label="Pre-run validation card"
      data-testid="launch-validation-card"
    >
      <h2>Pre-run checks</h2>
      <p data-testid="launch-validation-status">
        {model.hasErrors
          ? "Play is blocked until the issues below are fixed."
          : model.hasWarnings
            ? "Play is ready. Review warnings and approximation limits below."
            : "All checks passed. Play is ready."}
      </p>
      <div className="launch-validation-groups" data-testid="launch-validation-groups">
        {model.sections.map((section) => (
          <section
            key={section.id}
            className="launch-validation-section"
            data-testid={`launch-validation-section-${section.id}`}
          >
            <h3>{section.title}</h3>
            {section.items.length === 0 ? (
              <p data-testid={`launch-validation-ok-${section.id}`}>No issues.</p>
            ) : (
              <ul
                className="launch-validation-issue-list"
                data-testid={`launch-validation-errors-${section.id}`}
              >
                {section.items.map((item, index) => (
                  <li
                    key={`${section.id}-validation-item-${index.toString()}`}
                    className={`launch-validation-item launch-validation-item--${item.severity}`}
                    data-testid={`launch-validation-item-${section.id}-${index.toString()}`}
                  >
                    <span
                      className={`launch-validation-item-severity launch-validation-item-severity--${item.severity}`}
                      data-testid={`launch-validation-item-severity-${section.id}-${index.toString()}`}
                    >
                      {launchValidationSeverityLabel(item.severity)}
                    </span>
                    <span>{item.message}</span>
                    {item.explainHint === null ? null : (
                      <span
                        className="launch-validation-item-hint"
                        data-testid={`launch-validation-item-hint-${section.id}-${index.toString()}`}
                      >
                        Explain: {item.explainHint}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
