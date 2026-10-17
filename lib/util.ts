export const formatDateDDMMYYYY = (date: Date): string => {
    const options = { day: "2-digit", month: "2-digit", year: "numeric" };
    /// @ts-expect-error: It definitely works like this
    const formattedDate = new Intl.DateTimeFormat("en-GB", options).format(date);

    return formattedDate;
};

/**
 * Normalise a shortcode typed or pasted by a user: phone keyboards capitalise the first letter
 * and pasted text often has stray whitespace, but shortcodes (eActivities logins) are lowercase.
 */
export const normaliseShortcode = (shortcode: string): string => shortcode.trim().toLowerCase();
