import assert from "node:assert/strict";
import test from "node:test";
import { parseObjectArray } from "../src/lib/parse.js";

test("parses a clean array", () => {
  const posts = parseObjectArray('[{"content":"a"},{"content":"b"}]');
  assert.equal(posts.length, 2);
  assert.equal(posts[1].content, "b");
});

test("strips markdown fences", () => {
  const posts = parseObjectArray('```json\n[{"content":"a"}]\n```');
  assert.deepEqual(posts, [{ content: "a" }]);
});

test("strips reasoning scratchpads, closed or not", () => {
  assert.equal(parseObjectArray('<think>hmm [1,2]</think>[{"content":"a"}]').length, 1);
  assert.equal(parseObjectArray('[{"content":"a"}]\n<think>trailing').length, 1);
});

test("ignores prose before and after the array", () => {
  const posts = parseObjectArray('Sure! Here you go:\n[{"content":"a"}]\nLet me know if you want more.');
  assert.deepEqual(posts, [{ content: "a" }]);
});

test("recovers every complete object from a truncated response", () => {
  const truncated = '[{"content":"first"},{"content":"second"},{"content":"third but cut o';
  const posts = parseObjectArray(truncated);
  assert.equal(posts.length, 2);
  assert.deepEqual(
    posts.map((p) => p.content),
    ["first", "second"]
  );
});

test("is not confused by braces and brackets inside strings", () => {
  const posts = parseObjectArray('[{"content":"use {} and [] carefully"},{"content":"ok"}]');
  assert.equal(posts.length, 2);
  assert.equal(posts[0].content, "use {} and [] carefully");
});

test("handles escaped quotes inside content", () => {
  const posts = parseObjectArray('[{"content":"they said \\"no\\" twice"}]');
  assert.equal(posts[0].content, 'they said "no" twice');
});

test("accepts nested objects", () => {
  const posts = parseObjectArray('[{"content":"a","replies":[{"content":"r"}]}]');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].replies[0].content, "r");
});

test("returns an empty array for unusable input", () => {
  assert.deepEqual(parseObjectArray(""), []);
  assert.deepEqual(parseObjectArray("I cannot help with that."), []);
  assert.deepEqual(parseObjectArray(null), []);
});
