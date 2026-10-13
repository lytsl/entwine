/** The instance a mail comes from, by its host: one person may hold accounts on several. */
export const appLink = (baseURL: string) => {
  const url = new URL(baseURL);
  return { label: url.host, href: url.origin };
};
