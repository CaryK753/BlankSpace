const specifier = process.argv[2];

if (specifier === undefined) {
  throw new Error('A module specifier is required.');
}

console.log(import.meta.resolve(specifier));
