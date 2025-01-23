import type { SIMSession } from "../../SIMSession";
import { JSDOM } from "jsdom";

export class PRSService {
    constructor(public session: SIMSession) {}

    /**
     * Obtains matkul list from the PRS options API.
     */

    async getMatkulList(period: string, kodeUnit: string) {
        const unitmk = kodeUnit + "-" + "31#15#32#33#51";
        const params = new URLSearchParams();

        // Reverse engineered from PRS page
        params.append("f", "optmkprs");
        params.append("q[]", period);
        params.append("q[]", unitmk);
        params.append("q[]", "*");
        params.append("q[]", "1");
        params.append("q[]", "1");

        /**
         * Example Output:
         * <option value="">-- Pilih Mata Kuliah --</option>
         * <option value="2024:TF4204:15:1">01 - TF4204 - ALGORITMA DAN PEMROGRAMAN - 5 sks</option>
         * <option value="2024:TF4504:15:1">01 - TF4504 - BAHASA INGGRIS - 2 sks</option>
         * <option value="2024:TF4205:15:1">01 - TF4205 - DASAR SISTEM KOMPUTER - 2 sks</option>
         * <option value="2024:TF4229:15:1">02 - TF4229 - BASIS DATA - 3 sks</option>
         * 
         * Value Labels: Year:KodeMK:Unit:Period
         * Text Labels: number (ignore) - KodeMK (ignore) - NamaMK - ... sks
         */

        const r = await this.session
            .fetch("index.php?page=ajax", {
                method: "POST",
                headers: {
                    "X-Requested-With": "XMLHTTPRequest",
                },
                body: params,
            })
            .then((res) => res.text());

        const dom = new JSDOM(r);

        // For each option, get the value and text
        const options = dom.window.document.querySelectorAll("option");
        const matkulList = Array.from(options).map((option) => {
            const value = option.getAttribute("value");
            const text = option.textContent;

            if (!value || value.length === 0) {
                return null;
            }

            if (!text || text.length === 0) {
                return null;
            }

            const splittedValue = value.split(":");
            const splittedText = text.split(" - ");

            return {
                year: splittedValue[0],
                kodeMK: splittedValue[1],
                unit: splittedValue[2],
                period: splittedValue[3],
                namaMK: splittedText[splittedText.length - 2],
                sks: parseInt(splittedText[splittedText.length - 1].split(" ")[0], 10),
            };
        });

        return matkulList.filter((matkul) => matkul !== null);
    }
}
