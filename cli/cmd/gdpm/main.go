package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/aviorstudio/gdpm/cli/internal/commands"
)

func main() {
	os.Exit(run(os.Args))
}

func run(args []string) int {
	if len(args) < 2 {
		printUsage()
		return 2
	}

	cmd := args[1]
	switch cmd {
	case "-h", "--help", "help":
		printUsage()
		return 0
	case "init":
		return runInit(args[2:])
	case "add":
		return runAdd(args[2:])
	case "remove", "rm":
		return runRemove(args[2:])
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", cmd)
		printUsage()
		return 2
	}
}

func runInit(args []string) int {
	fs := flag.NewFlagSet("init", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if fs.NArg() != 0 {
		fmt.Fprintln(os.Stderr, "usage: gdpm init")
		return 2
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := commands.Init(ctx, commands.InitOptions{}); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}

func runAdd(args []string) int {
	fs := flag.NewFlagSet("add", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "usage: gdpm add @username/plugin[@version]")
		return 2
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := commands.Add(ctx, commands.AddOptions{
		Spec: fs.Arg(0),
	}); err != nil {
		if errors.Is(err, commands.ErrUserInput) {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}

func runRemove(args []string) int {
	fs := flag.NewFlagSet("remove", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(os.Stderr, "usage: gdpm remove @username/plugin")
		return 2
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := commands.Remove(ctx, commands.RemoveOptions{
		Spec: fs.Arg(0),
	}); err != nil {
		if errors.Is(err, commands.ErrUserInput) {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}

func printUsage() {
	fmt.Fprintln(os.Stderr, `gdpm - Godot plugin manager (GitHub addons installer)

Usage:
  gdpm init
  gdpm add @username/plugin[@version]
  gdpm remove @username/plugin

Environment:
  GITHUB_TOKEN   Optional GitHub token to avoid rate limits.`)
}
