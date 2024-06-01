import type { LoginDomain } from "./types/SIMLogin.js";

export class SIMSession {
    PHPSESSID: string;
    static readonly LOGIN_BASE_URL = "https://sim.petra.ac.id/petragate/";
    static readonly BASE_URL = "https://sim.petra.ac.id/petraakad/";

    constructor(PHPSESSID: string) {
        this.PHPSESSID = PHPSESSID;
    }

    public fetch(path: string, init?: RequestInit) {
        return fetch(SIMSession.BASE_URL + path, {
            ...init,
            headers: {
                ...init?.headers,
                Cookie: `PHPSESSID=${this.PHPSESSID}`,
            },
        });
    }

    public static async login(
        username: string,
        password: string,
        domain: LoginDomain
    ) {
        // Initial fetch to get CSRF and PHPSESSID
        const initialFetch = await fetch(
            SIMSession.LOGIN_BASE_URL + "index.php"
        );

        // Get PHPSESSID from cookie
        // Get Set-Cookie, and obtain PHPSESSID from it
        const initialHeaders = initialFetch.headers;
        const setCookie = initialHeaders.get("Set-Cookie");
        if (setCookie === null) {
            throw new Error("Set-Cookie header not found");
        }
        const PHPSESSID = setCookie.split(";")[0].split("=")[1];

        // Get CSRF from HTML
        const initialHTML = await initialFetch.text();
        const csrf = initialHTML
            .split('name="csrf_name" value="')[1]
            .split('"')[0];

        // Send login request
        const loginFetch = await fetch(
            SIMSession.LOGIN_BASE_URL + "index.php",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Cookie: `PHPSESSID=${PHPSESSID}`,
                },
                redirect: "follow",
                body: new URLSearchParams({
                    userid: username,
                    passx: password,
                    domain: domain,
                    csrf_name: csrf,
                }),
            }
        );

        // If response is redirect to menu.php, then login is successful. Otherwise, login failed.
        if (loginFetch.url === SIMSession.BASE_URL + "index.php?page=home") {
            return new SIMSession(PHPSESSID);
        }

        const loginGagalFound =
            (await loginFetch.text()).indexOf("Login gagal") !== -1;

        if (loginGagalFound) {
            throw new Error("Login failed. Username or password is incorrect.");
        }

        throw new Error(
            `Login failed. Expected to end up in ?page=home, but ended up in ${loginFetch.url}`
        );
    }
}
