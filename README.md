## Development

### Prerequisites

- Go v1.22 or higher
- Node.js v20 or higher
- [Air](https://github.com/air-verse/air)

To install **air** (live reload for Go applications) run the following command:

```shell
go install github.com/air-verse/air@latest
```

Go to `./client/` directory and install the dependencies:

```shell
npm install
```

### Running the Application

To automatically restart the server when files change, run the following command *from the root* of the project:

```shell
air
```

To automatically build client-side JavaScript code when one of the TypeScript files change, run the following command from `./client/` directory:

```shell
npx webpack --mode=development --watch
```

