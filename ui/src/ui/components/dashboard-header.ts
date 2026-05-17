import { LitElement, html, nothing } from "lit";
import { property } from "lit/decorators.js";
import { pathForTab, titleForTab, type Tab } from "../navigation.js";

export class DashboardHeader extends LitElement {
  override createRenderRoot() {
    return this;
  }

  @property() tab: Tab = "overview";
  @property() basePath = "";
  @property() agentLabel = "";

  private get astroclawIconSrc(): string {
    const base = this.basePath.trim().replace(/\/$/, "");
    return base ? `${base}/favicon.svg` : "favicon.svg";
  }

  private readonly handleOverviewClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent("navigate", { detail: "overview", bubbles: true, composed: true }),
    );
  };

  override render() {
    const label = titleForTab(this.tab);
    const agentLabel = this.agentLabel.trim();

    return html`
      <div class="dashboard-header">
        <div class="dashboard-header__breadcrumb">
          <a
            class="dashboard-header__breadcrumb-link"
            href=${pathForTab("overview", this.basePath)}
            @click=${this.handleOverviewClick}
            style="display:inline-flex;align-items:center;gap:6px;"
          >
            <img
              src=${this.astroclawIconSrc}
              alt=""
              aria-hidden="true"
              width="20"
              height="20"
              style="display:inline-block;vertical-align:middle;border-radius:4px;"
            />
            Astroclaw
          </a>
          ${agentLabel
            ? html`
                <span class="dashboard-header__breadcrumb-segment">
                  <span class="dashboard-header__breadcrumb-sep">›</span>
                  <span class="dashboard-header__breadcrumb-context" title=${agentLabel}>
                    ${agentLabel}
                  </span>
                </span>
              `
            : nothing}
          <span class="dashboard-header__breadcrumb-sep">›</span>
          <span class="dashboard-header__breadcrumb-current">${label}</span>
        </div>
        <div class="dashboard-header__actions">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("dashboard-header")) {
  customElements.define("dashboard-header", DashboardHeader);
}
