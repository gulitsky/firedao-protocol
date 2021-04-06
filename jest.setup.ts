import { waffleJest } from "@ethereum-waffle/jest";

expect.extend(waffleJest);
jest.setTimeout(60000);
