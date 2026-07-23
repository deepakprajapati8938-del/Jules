const text = `Velocity-Time ($v-t$) Graph for Constant Acceleration

For a particle moving with constant acceleration ($a$), its velocity ($v$) at any time ($t$) is given by the first equation of motion:

$$v = u + at$$

Where:
* $u$ = Initial velocity (velocity at $t = 0$)
* $v$ = Velocity at time $t$
* $a$ = Constant acceleration
* $t$ = Time elapsed

Key Characteristics of the $v-t$ Graph:
1. Shape: It is a straight line because $v$ is a linear function of $t$.`;

const preprocessMath = (text) => {
  if (!text) return text;
  let processed = text.replace(/\$\$(.*?)\$\$/gs, '\n```math_block\n$1\n```\n');
  processed = processed.replace(/\$((?:\\.|[^$\n])*?)\$/g, '`math_inline $1`');
  return processed;
};

console.log(preprocessMath(text));
