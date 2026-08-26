import { getMessages } from "next-intl/server";

/**
 * Sends only the message namespaces a section actually renders to the browser.
 *
 * By default next-intl serialises the whole message file into the page, which
 * would put every staff and owner string — the console's routes, features and
 * labels — into the HTML of the public availability page. That is not a data
 * leak, but it advertises the admin surface to anyone who views source, and it
 * ships bytes a driver will never use.
 *
 * Server components are unaffected: `getTranslations` reads from the request
 * config, not from this provider, so they still see every namespace.
 */
export async function pickMessages(
  namespaces: readonly string[],
): Promise<Record<string, unknown>> {
  const all = (await getMessages()) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};

  for (const namespace of namespaces) {
    if (namespace in all) picked[namespace] = all[namespace];
  }

  return picked;
}
