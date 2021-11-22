'use strict';

let gl;                         // The webgl context.

let iAttribVertex;              // Location of the attribute variable in the shader program.
let iAttribTexture;             // Location of the attribute variable in the shader program.

let iColor;                     // Location of the uniform specifying a color for the primitive.
let iColorCoef;                 // Location of the uniform specifying a color for the primitive.
let iModelViewProjectionMatrix; // Location of the uniform matrix representing the combined transformation.
let iTextureMappingUnit;

let iVertexBuffer;              // Buffer to hold the values.
let iTexBuffer;                 // Buffer to hold the values.

let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

let eyeSepInput;
let eyeSepSlider;

const deviceOrientation = {
    alpha: 0,
    beta: 90,
    gamma: 0
}
const DEG_TO_RAD = Math.PI / 180; // Degree-to-Radian conversion

class StereoCamera {
    constructor(
        Convergence,
        EyeSeparation,
        AspectRatio,
        FOV,
        NearClippingDistance,
        FarClippingDistance
    ) {
        this.mConvergence = Convergence;
        this.mEyeSeparation = EyeSeparation;
        this.mAspectRatio = AspectRatio;
        this.mFOV = FOV * Math.PI / 180.0
        this.mNearClippingDistance = NearClippingDistance;
        this.mFarClippingDistance = FarClippingDistance;
    }

    getLeftFrustum = function () {
        const top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        const bottom = -top;

        const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        const left = -b * this.mNearClippingDistance / this.mConvergence;
        const right = c * this.mNearClippingDistance / this.mConvergence;

        const projection = m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);
        const translation = m4.translation(this.mEyeSeparation / 2 / 100, 0, 0);

        return m4.multiply(projection, translation)
    }

    getRightFrustum = function () {
        const top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        const bottom = -top;

        const a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        const b = a - this.mEyeSeparation / 2;
        const c = a + this.mEyeSeparation / 2;

        const left = -c * this.mNearClippingDistance / this.mConvergence;
        const right = b * this.mNearClippingDistance / this.mConvergence;

        const projection = m4.frustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);
        const translation = m4.translation(-this.mEyeSeparation / 2 / 100, 0, 0);

        return m4.multiply(projection, translation)
    }
}

/* Draws a WebGL primitive.  The first parameter must be one of the constants
 * that specify primitives:  gl.POINTS, gl.LINES, gl.LINE_LOOP, gl.LINE_STRIP,
 * gl.TRIANGLES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN.  The second parameter must
 * be an array of 4 numbers in the range 0.0 to 1.0, giving the RGBA color of
 * the color of the primitive.  The third parameter must be an array of numbers.
 * The length of the array must be a multiple of 3.  Each triple of numbers provides
 * xyz-coords for one vertex for the primitive.  This assumes that u_color is the
 * location of a color uniform in the shader program, a_coords_loc is the location of
 * the coords attribute, and a_coords_buffer is a VBO for the coords attribute.
 */
function drawPrimitive( primitiveType, color, vertices, texCoords )
{
     gl.uniform4fv(iColor, color);
     gl.uniform1f(iColorCoef, 0.0);

     gl.enableVertexAttribArray(iAttribVertex);
     gl.bindBuffer(gl.ARRAY_BUFFER, iVertexBuffer);
     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
     gl.vertexAttribPointer(iAttribVertex, 3, gl.FLOAT, false, 0, 0);

     
    gl.disableVertexAttribArray(iAttribTexture);
    gl.vertexAttrib2f(iAttribTexture, 0.0, 0.0);
    gl.uniform1f(iColorCoef, 1.0);
    

    gl.drawArrays(primitiveType, 0, vertices.length/3);
}


let a = 0.5;
let r = 2;
let Q = 0.25*Math.PI;

function x_u(u){
    return a * Math.pow(Math.cos(u), 3);
}

function z_u(u){
    return a * Math.pow(Math.sin(u), 3);
}

function X_uv(u, v){
    //return 1 * Math.sin(u) * Math.cos(v);
    return (r + x_u(u) * Math.cos(Q) - z_u(u) * Math.sin(Q)) * Math.cos(v);
}

function Y_uv(u, v){
    //return 1 * Math.sin(u) * Math.sin(v);
    return (r + x_u(u) * Math.cos(Q) - z_u(u) * Math.sin(Q)) * Math.sin(v);
}

function Z_u(u){
    //return 1 * Math.cos(u);
    return x_u(u) * Math.sin(Q) + z_u(u) * Math.cos(Q);
}
/* Draws a colored figure, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */

function getRotationMatrix(alpha, beta, gamma) {
    const _x = beta ? beta * DEG_TO_RAD : 0; // beta value
    const _y = gamma ? gamma * DEG_TO_RAD : 0; // gamma value
    const _z = alpha ? alpha * DEG_TO_RAD : 0; // alpha value

    const cX = Math.cos(_x);
    const cY = Math.cos(_y);
    const cZ = Math.cos(_z);
    const sX = Math.sin(_x);
    const sY = Math.sin(_y);
    const sZ = Math.sin(_z);

    //
    // ZXY rotation matrix construction.
    //

    const m11 = cZ * cY - sZ * sX * sY;
    const m12 = -cX * sZ;
    const m13 = cY * sZ * sX + cZ * sY;

    const m21 = cY * sZ + cZ * sX * sY;
    const m22 = cZ * cX;
    const m23 = sZ * sY - cZ * cY * sX;

    const m31 = -cX * sY;
    const m32 = sX;
    const m33 = cX * cY;

    // return [
    //     m11, m12, m13,
    //     m21, m22, m23,
    //     m31, m32, m33,
    // ];

    return [
        m11, m12, m13, 0,
        m21, m22, m23, 0,
        m31, m32, m33, 0,
        0, 0, 0, 1
    ];
}

function draw() {
    //_resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const cam = new StereoCamera(
        2000.0,
        parseFloat(eyeSepInput.value),
        1,
        45.0,
        1.0,
        200000.0
    );

    /* Get the view matrix from the SimpleRotator object.*/
    const modelView = spaceball.getViewMatrix();

    const rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    const translateToPointZero = m4.translation(0, 0, -10);

    const matAccum0 = m4.multiply(rotateToPointZero, modelView);
    //const matAccum1 = m4.multiply(translateToPointZero, matAccum0);
    const matAccum1 = m4.multiply(translateToPointZero,
         getRotationMatrix(deviceOrientation.alpha, deviceOrientation.beta, deviceOrientation.gamma));

    const modelViewProjectionL = m4.multiply(cam.getLeftFrustum(), matAccum1);
    const modelViewProjectionR = m4.multiply(cam.getRightFrustum(), matAccum1);

    // Left
    gl.uniformMatrix4fv(iModelViewProjectionMatrix, false, modelViewProjectionL);
    gl.uniform1i(iTextureMappingUnit, 0);
    gl.colorMask(true, false, false, false);
    DrawSurface();

    gl.clear(gl.DEPTH_BUFFER_BIT);

    // Right
    gl.uniformMatrix4fv(iModelViewProjectionMatrix, false, modelViewProjectionR);
    gl.uniform1i(iTextureMappingUnit, 0);
    gl.colorMask(false, true, true, false);
    DrawSurface();

    gl.colorMask(true, true, true, true);

  
    /* Draw coordinate axes as thick colored lines that extend through the cube. */
    gl.lineWidth(4);
     drawPrimitive(gl.LINES, [1, 0, 0, 1], [-2, 0, 0, 2, 0, 0]);
     drawPrimitive(gl.LINES, [0, 1, 0, 1], [0, -2, 0, 0, 2, 0]);
     drawPrimitive(gl.LINES, [0, 0, 1, 1], [0, 0, -2, 0, 0, 2]);
    gl.lineWidth(1);
}
function DrawSurface() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    

    let step_u = 0.001;
    let step_v = 0.1;
    let count_i = 2/step_u;
    let count_j = 2/step_v;
    for(let i = 0, ii=0; i <= 2; i+=step_u, ii++){
        let v = i * Math.PI;
        
        let vertices = [];
        for(let j = 0, ij = 0; j <= 2; j+=step_v, ij++){
            let u = j * Math.PI;
 
            let X = X_uv(u, v);
            let Y = Y_uv(u, v);
            let Z = Z_u(u);

            vertices.push(X);
            vertices.push(Y);
            vertices.push(Z);
            
        }

        gl.uniform4fv(iColor, [0.5, 0.5, 0.5, 1]);
        gl.uniform1f(iColorCoef, 0.0);
   
        gl.enableVertexAttribArray(iAttribVertex);
        gl.bindBuffer(gl.ARRAY_BUFFER, iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
        gl.vertexAttribPointer(iAttribVertex, 3, gl.FLOAT, false, 0, 0);
   
        
       gl.disableVertexAttribArray(iAttribTexture);
       gl.vertexAttrib2f(iAttribTexture, 0.0, 0.0);
       gl.uniform1f(iColorCoef, 1.0);
       
   
       gl.drawArrays(gl.LINE_LOOP, 0, vertices.length/3);

    //    drawPrimitive( gl.TRIANGLE_STRIP, [0.73, 0.79, 0.32, 1], vertices);
    }
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );
    gl.useProgram(prog);

    iAttribVertex  =  gl.getAttribLocation(prog, "vertex");
    iAttribTexture =  gl.getAttribLocation(prog, "texCoord");

    iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    iColor                     = gl.getUniformLocation(prog, "color");
    iColorCoef                 = gl.getUniformLocation(prog, "fColorCoef");
    iTextureMappingUnit        = gl.getUniformLocation(prog, "u_texture");

    iVertexBuffer = gl.createBuffer();
    iTexBuffer    = gl.createBuffer();


    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    eyeSepInput = document.getElementById('eye');
    eyeSepSlider = document.getElementById('eyeOut');
    window.addEventListener('deviceorientation', (e) => {
        deviceOrientation.alpha = e.alpha;
        deviceOrientation.beta = e.beta;
        deviceOrientation.gamma = e.gamma;
        draw()
    })

    
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
    eyeSepSlider.addEventListener('input', () => {
        eyeSepInput.value = eyeSepSlider.value;
        console.log("eyeSepInput " + eyeSepInput.value);
    });

    eyeSepInput.addEventListener('change', () => {
        eyeSepSlider.value = eyeSepInput.value;
        console.log("eyeSepSlider "+eyeSepSlider.value);
        draw();
    });
}
