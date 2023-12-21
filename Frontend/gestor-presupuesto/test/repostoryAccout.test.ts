import { describe, assert, expect, test, vi, beforeEach } from "vitest";
import { AccountRepotory } from "../src/repository/account.repository";
import type { AccoutInfoInterface } from "../src/interface/account.interface";

// Edit an assertion and save to see HMR in action
global.fetch = vi.fn();

function createFetchResponse(data: any) {
  return { json: () => new Promise((resolve) => resolve(data)) };
}
describe("repository account ", () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  test("findAll returns the result", async () => {
    const todoListResponse: AccoutInfoInterface[] = [
      {
        AccountInfo: {
          id: "1",
          name: "test",
          bank: "testBank",
          initialBalance: 1000,
        },
        CurrentBalance: 2000,
      },
    ];
    const token = "token";

    fetch.mockResolvedValue(createFetchResponse(todoListResponse));
    const repository = new AccountRepotory(token);

    const todoList = await repository.findAll();

    expect(todoList).toStrictEqual(todoListResponse);
  });
  test("to created a account ", async () => {
    const account = {
      name: "test",
      bank: "testBank",
      initialBalance: 1000,
    };

    fetch.mockResolvedValue(createFetchResponse("created"));
    const repository = new AccountRepotory("token");
    repository.create(account);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
