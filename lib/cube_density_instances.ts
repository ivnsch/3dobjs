import { mat4, vec3, vec4 } from "gl-matrix";
import { Entity } from "./entity";
import { vertices } from "./cube_entity";

// for now inheritance, may change
// these functions should be generic for all drawables anyway
export class CubeDensityInstances extends Entity {
  private lastTime: number = 0;
  private velocities: vec3[] = [];

  spacing = 10;

  instancesBuffer: GPUBuffer;
  numInstances = Math.pow(this.spacing, 3); // remember to set this in *_axes_transforms in the shader too
  matrixFloatCount = 16; // 4x4 matrix
  matrixSize = 4 * this.matrixFloatCount;
  private matrices: mat4[] = [];
  instancesMatrices = new Float32Array(
    this.matrixFloatCount * this.numInstances
  );

  colorsBuffer: GPUBuffer;
  colorVectorFloatCount = 4;
  instancesColors = new Float32Array(
    this.colorVectorFloatCount * this.numInstances
  );

  constructor(device: GPUDevice) {
    // x y z
    // prettier-ignore
    super(device, vertices(-4))

    this.initInstances();
    this.instancesBuffer = this.createInstancesBuffer(device, "cube instances");
    this.colorsBuffer = this.createColorsBuffer(device, "cube colors buffer");
    this.initColors();
  }

  private initInstances = () => {
    var index = 0;

    const hs = this.spacing / 2; // half spacing

    for (let x = 0; x < this.spacing; x++) {
      for (let y = 0; y < this.spacing; y++) {
        for (let z = 0; z < this.spacing; z++) {
          const m = mat4.create();
          mat4.identity(m);
          // add at grid position
          const v = vec3.fromValues(x - hs, y - hs, z - hs);
          mat4.translate(m, m, v);
          // scale cubes down
          const scale = 0.1;
          const scaleV = vec3.fromValues(scale, scale, scale);
          mat4.scale(m, m, scaleV);
          // add transform matrix
          this.matrices.push(m);
          this.velocities.push(vec3.create());
          index++;
        }
      }
    }
    this.updateInstanceMatrices();
  };

  initColors = () => {
    const spacing = 10;
    const radius = 0.1;
    var index = 0;
    for (let x = 0; x < spacing; x++) {
      for (let y = 0; y < spacing; y++) {
        for (let z = 0; z < spacing; z++) {
          const density = calcDensity(vec3.fromValues(x, y, z), radius);
          const color = colorForDensity(density);
          this.instancesColors.set(color, this.colorVectorFloatCount * index);
          index++;
        }
      }
    }
  };

  // updates instance matrices to match matrices
  private updateInstanceMatrices = () => {
    this.matrices.forEach((matrix, index) => {
      this.instancesMatrices.set(matrix, this.matrixFloatCount * index);
    });
  };

  private createInstancesBuffer = (
    device: GPUDevice,
    label: string
  ): GPUBuffer => {
    const bufferSize = this.numInstances * this.matrixSize;
    return device.createBuffer({
      label: label,
      size: bufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  };

  private createColorsBuffer = (
    device: GPUDevice,
    label: string
  ): GPUBuffer => {
    const bufferSize = this.instancesColors.byteLength;
    return device.createBuffer({
      label: label,
      size: bufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  };

  private fillColorsBuffer = () => {
    for (let index = 0; index < this.numInstances; index++) {
      const color = vec4.fromValues(0.0, 0.0, 1.0, 0.0);
      this.instancesColors.set(color, this.colorVectorFloatCount * index);
    }
  };

  render = (device: GPUDevice, pass: GPURenderPassEncoder, time: number) => {
    // this.applyPhysics(time);
    pass.setBindGroup(0, this.bindGroup);
    pass.setVertexBuffer(0, this.buffer);
    pass.draw(36, this.numInstances);
    device.queue.writeBuffer(
      this.instancesBuffer,
      0,
      this.instancesMatrices.buffer,
      this.instancesMatrices.byteOffset,
      this.instancesMatrices.byteLength
    );
    device.queue.writeBuffer(
      this.colorsBuffer,
      0,
      this.instancesColors.buffer,
      this.instancesColors.byteOffset,
      this.instancesColors.byteLength
    );
  };

  applyPhysics = (time: number) => {
    // this.applyGravity(time);
  };

  applyGravity = (time: number) => {
    const seconds = time / 1000;
    const timeDelta = seconds - this.lastTime;

    // in the first iteration timeDelta is too large
    // the cube would start with a noticeable offset
    // so we just store the time and exit
    if (!this.lastTime) {
      this.lastTime = seconds;
      return;
    }

    this.matrices.forEach((matrix, index) => {
      const velocity = this.velocities[index];

      // update velocity based on gravity
      const velocityDelta = vec3.create();
      const gravity = -0.0008;
      vec3.scale(velocityDelta, vec3.fromValues(0, 1, 0), gravity * timeDelta);
      vec3.add(velocity, velocity, velocityDelta);

      // update position based on velocity
      const positionDelta = vec3.create();
      vec3.scale(positionDelta, velocity, timeDelta);

      mat4.translate(matrix, matrix, positionDelta);

      const boundY = 2;
      const collisionDamping = 0.9;
      if (matrix[13] < -boundY) {
        matrix[13] = -boundY;

        if (velocity[1] < 0) {
          velocity[1] *= -1 * collisionDamping;
        }
      }
    });

    this.updateInstanceMatrices();
  };
}

const calcDensity = (position: vec3, radius: number) => {
  return 0;
};

const colorForDensity = (density: number): vec4 => {
  return vec4.fromValues(0, 0, 1, 0);
};