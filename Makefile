# Multi-arch Docker image build + publish to Docker Hub.
#
#   make publish                          # the one command
#   make publish DOCKER_IMAGE=you/co-driver DOCKER_TAG=v0.2  # override

DOCKER_IMAGE ?= obedbj/co-driver
DOCKER_TAG   ?= latest
PLATFORMS    ?= linux/amd64,linux/arm64
BUILDER      ?= co-driver-builder

.PHONY: publish setup builder qemu

publish: setup
	docker buildx build \
	  --builder $(BUILDER) \
	  --platform $(PLATFORMS) \
	  -t $(DOCKER_IMAGE):$(DOCKER_TAG) \
	  --push .

setup: builder qemu

builder:
	@docker buildx inspect $(BUILDER) >/dev/null 2>&1 || \
	  docker buildx create --name $(BUILDER) --driver docker-container

qemu:
	@docker buildx inspect $(BUILDER) --bootstrap 2>/dev/null | grep -q linux/arm64 || \
	  docker run --privileged --rm tonistiigi/binfmt --install arm64
