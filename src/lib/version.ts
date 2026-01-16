// Auto-generated version based on build time
const BUILD_DATE = new Date();

export const APP_VERSION = {
  // Major.Minor.Patch format based on date
  version: `1.${BUILD_DATE.getMonth() + 1}.${BUILD_DATE.getDate()}`,
  // Full build timestamp
  buildNumber: BUILD_DATE.getTime().toString(36).toUpperCase(),
  // Human readable build date
  buildDate: BUILD_DATE.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
  // Full version string
  get full() {
    return `v${this.version} (${this.buildNumber})`;
  },
  // Short version
  get short() {
    return `v${this.version}`;
  },
};
