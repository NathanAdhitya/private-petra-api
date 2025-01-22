# private-petra-api

This repository contains parsers and other tools to access SIM Petra including its related resources for programmatic use.

This repository requires Bun to run. Follow the [Bun installation guide](https://bun.sh/docs/installation) to install Bun.

This repository is not official, nor is it supported by PCU. This tool is developed for personal use and personal entertainment.

Use at your own risk. No warranty is given. Given the nature of this tool, it may break at any time without warning.

## Features

-   Login & session management
-   Fetch KHS & Transkrip data (CPL and CPMK details are not implemented yet.)

## Developer Notes

There are no official ways to properly include this API into your programs just yet. This project is still a WIP.

If you would like to try and run the program, you may clone this project and run the `run` script (index.ts) for now.

## Example .env

```env
SIM_USERNAME=username
SIM_PASSWORD=password
```

## Setup

1. Clone this repository
2. `bun install`
3. Modify `src/index.ts` as needed
4. `bun run src/index.ts`
5. Profit???

## I want to scrape and convert jadwal from SIM to JSON

Example snippet to obtain the initial data:

```ts
const jadwalKuliahGlobal = new JadwalKuliahGlobal(session);
const results = await jadwalKuliahGlobal.getAllJadwalKuliah();

// Save it to a file for dev
function replacer(key: string, value: any) {
    if (value instanceof Map) {
        // turn map into a regular object
        return Object.fromEntries(value);
    } else {
        return value;
    }
}

await Bun.write(
    Bun.file("output/jadwal.json"),
    JSON.stringify(results, replacer, 2)
);
```

Once done, convert the data to a format that you can use. If you wish to convert the data compatible for the [prs.natha.my.id](https://prs.natha.my.id) project, run the script in `src/cli/convertJadwal.ts`. This can be done after generating the `jadwal.json` then running `bun run src/cli/convertJadwal.ts`. The resulting file will appear in `output/newJadwal.json`.
