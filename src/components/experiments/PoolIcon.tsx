/**
 * PoolIcon — inlined version of the user's in-ground pool icon
 * ============================================================
 *
 * The source file (public/images/pool-icon-inground.svg) is inlined
 * here as JSX so individual elements can be addressed by class name.
 * Two groups are isolated for chemistry-driven color reactivity:
 *
 *   .pool-icon__water   — the main blue pool body + surface ripples.
 *   .pool-icon__ladder  — the steel-rail ladder on the left side.
 *
 * Both groups are colored via CSS variables so the parent component
 * can drive water + ladder color independently without touching the
 * SVG tree:
 *
 *   --pool-water-light    : top color of the water gradient
 *   --pool-water-dark     : bottom color of the water gradient
 *   --pool-water-ripple   : color of the wavy surface lines
 *   --pool-ladder-color   : fill for ladder rails + rungs
 *
 * Other layers (gold frame, orange sun-burst rays, pool light) are
 * left at their original colors and grouped under `.pool-icon__decor`
 * in case we want to tone them down later, but they aren't reactive.
 */

type Props = {
  /** CSS class on the outer SVG (e.g. for sizing). */
  className?: string;
  /** Inline style override (e.g. setting CSS vars from the parent). */
  style?: any;
};

export default function PoolIcon({ className, style }: Props) {
  return (
    <svg
      class={`pool-icon ${className ?? ''}`}
      style={style}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Water gradients — stop colors driven by CSS variables so the
            chemistry state can re-tint the water without rebuilding
            the SVG tree. */}
        <linearGradient
          id="poolWaterMain"
          gradientUnits="userSpaceOnUse"
          x1="255.86" y1="324.55" x2="255.86" y2="806.74"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" style="stop-color: var(--pool-water-light, #7ECCFD)" />
          <stop offset="1" style="stop-color: var(--pool-water-dark, #3FA9F5)" />
        </linearGradient>
        <linearGradient
          id="poolWaterOverlay"
          gradientUnits="userSpaceOnUse"
          x1="297.97" y1="276.07" x2="133.28" y2="111.39"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" style="stop-color: var(--pool-water-light, #7ECCFD); stop-opacity:0" />
          <stop offset="1" style="stop-color: var(--pool-water-dark, #3FA9F5)" />
        </linearGradient>
        <linearGradient
          id="poolWaterSurface"
          gradientUnits="userSpaceOnUse"
          x1="183.08" y1="100.09" x2="183.08" y2="187.43"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" style="stop-color: var(--pool-water-light, #7ECCFD); stop-opacity:0" />
          <stop offset="1" style="stop-color: var(--pool-water-light, #7ECCFD)" />
        </linearGradient>

        {/* Gold frame — kept as-is. */}
        <linearGradient
          id="poolFrame"
          gradientUnits="userSpaceOnUse"
          x1="255.86" y1="89.67" x2="255.86" y2="616.56"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" stop-color="#FFE7A5" />
          <stop offset="1" stop-color="#FFBF5C" />
        </linearGradient>

        {/* Decorative orange sun-burst — single shared radial gradient. */}
        <radialGradient
          id="poolDecorRays"
          cx="255.86" cy="245.17" r="286.84"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stop-color="#D54003" />
          <stop offset="0.318" stop-color="#D94303" stop-opacity="0.682" />
          <stop offset="0.615" stop-color="#E44A02" stop-opacity="0.385" />
          <stop offset="0.903" stop-color="#F75701" stop-opacity="0.097" />
          <stop offset="1" stop-color="#FF5D00" stop-opacity="0" />
        </radialGradient>

        {/* Yellow accent (top of pool) — bottom corner near rim. */}
        <linearGradient
          id="poolAccent1"
          gradientUnits="userSpaceOnUse"
          x1="247.86" y1="103.45" x2="191.91" y2="56.39"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" stop-color="#FF5D00" stop-opacity="0" />
          <stop offset="1" stop-color="#D54003" />
        </linearGradient>
        <linearGradient
          id="poolAccent2"
          gradientUnits="userSpaceOnUse"
          x1="248.8" y1="107.28" x2="1.8" y2="58.61"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" stop-color="#FF5D00" stop-opacity="0" />
          <stop offset="1" stop-color="#D54003" />
        </linearGradient>

        {/* Water patch behind the life ring (extends down-right past
            it). Uses the SAME light → dark stops as the main pool
            body so it reads as continuous water, not a darker zone. */}
        <linearGradient
          id="poolWaterDeep"
          gradientUnits="userSpaceOnUse"
          x1="476.64" y1="367.02" x2="374.1" y2="264.48"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" style="stop-color: var(--pool-water-light, #7ECCFD)" />
          <stop offset="1" style="stop-color: var(--pool-water-dark, #3FA9F5)" />
        </linearGradient>

        {/* Ladder gradient defs — converted to a single variable-driven
            fill so we can re-tint to rust brown when LSI is corrosive. */}
        <linearGradient
          id="poolLadder"
          gradientUnits="userSpaceOnUse"
          x1="133.06" y1="128.02" x2="168.75" y2="128.02"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" style="stop-color: var(--pool-ladder-light, #E2EDF2)" />
          <stop offset="1" style="stop-color: var(--pool-ladder-color, #9FC7E2)" />
        </linearGradient>
        <linearGradient
          id="poolLadderJoin"
          gradientUnits="userSpaceOnUse"
          x1="227.89" y1="125.97" x2="188.88" y2="98.94"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" style="stop-color: var(--pool-ladder-color, #9FC7E2); stop-opacity:0" />
          <stop offset="1" style="stop-color: var(--pool-ladder-shadow, #4975AD)" />
        </linearGradient>
        <linearGradient
          id="poolLadderJoinSmall"
          gradientUnits="userSpaceOnUse"
          x1="166.58" y1="98.64" x2="143.47" y2="75.53"
          gradientTransform="matrix(1.0039 0 0 -1.0039 0.1922 516.5609)"
        >
          <stop offset="0" style="stop-color: var(--pool-ladder-color, #9FC7E2); stop-opacity:0" />
          <stop offset="1" style="stop-color: var(--pool-ladder-shadow, #4975AD)" />
        </linearGradient>
      </defs>

      {/* === WATER LAYER ============================================
          Main pool body + darker overlay + animated surface ripples
          + bottom water-surface gradient. All driven by CSS vars. */}
      <g class="pool-icon__water">
        {/* Main pool blue */}
        <path
          d="M336.695,44.581L336.695,44.581c-31.121,0-60.094,9.185-84.36,24.992
            c-35.567,23.168-77.036,35.685-119.479,35.105c-0.513-0.007-1.027-0.011-1.542-0.011l0,0c-61.192,0-110.798,49.606-110.798,110.798
            v81.072c0,61.192,49.606,110.798,110.798,110.798l0,0c0.515,0,1.029-0.004,1.542-0.01c42.443-0.58,83.913,11.937,119.479,35.105
            c24.266,15.807,53.239,24.992,84.36,24.992l0,0c85.488,0,154.789-69.302,154.789-154.789V199.37
            C491.484,113.883,422.182,44.581,336.695,44.581z"
          fill="url(#poolWaterMain)"
        />
        {/* Inner darker-blue overlay (top-left wash) */}
        <path
          d="M131.187,125.185c-0.765,0.001-1.528,0.011-2.288,0.031c-0.03,0.001-0.059,0.003-0.089,0.003
            c-0.775,0.022-1.548,0.052-2.319,0.093c-0.001,0-0.002,0-0.004,0v89.52c0,5.417,3.068,10.109,7.558,12.456L352.7,445.943
            c60.485-7.217,108.746-54.796,117.007-114.958L239.359,100.639c-4.157,2.083-8.358,4.037-12.595,5.862
            c-4.222,1.814-8.481,3.501-12.774,5.055c-2.122,0.768-4.253,1.503-6.39,2.207c-4.208,1.379-8.444,2.633-12.705,3.762
            c-2.105,0.551-4.214,1.076-6.331,1.567c-2.071,0.478-4.147,0.924-6.227,1.342c-2.054,0.409-4.113,0.786-6.175,1.136
            c-4.122,0.683-8.26,1.25-12.408,1.7c-2.013,0.208-4.029,0.392-6.047,0.544c-1.865,0.134-3.733,0.243-5.601,0.329
            c-1.99,0.083-3.981,0.137-5.972,0.166c-2.039,0.018-4.078,0.017-6.119-0.021c-0.586-0.011-1.152-0.016-1.72-0.016
            C131.272,125.184,131.23,125.185,131.187,125.185z"
          fill="url(#poolWaterOverlay)"
        />
        {/* Bottom-of-pool water surface gradient */}
        <path
          d="M154.597,214.833v-9.636v-15.541h56.648v23.089v2.088c0,7.76,6.295,14.055,14.055,14.055
            c0.663,0,1.315-0.05,1.948-0.141c6.847-0.944,12.107-6.817,12.107-13.914v-23.086l0.005,0.005V100.64
            c-33.539,16.809-69.826,25.261-106.326,24.561c-0.586-0.011-1.152-0.016-1.72-0.016c-1.619,0-3.228,0.045-4.826,0.13v89.52
            c0,7.762,6.293,14.055,14.055,14.055C148.305,228.889,154.597,222.596,154.597,214.833z M154.597,156.094v-15.541h56.648v20.993
            v0.001h-56.648V156.094z"
          fill="url(#poolWaterSurface)"
        />
        {/* Deeper-blue patch behind / around the life ring — covers
            both the area visible inside the ring and the wedge that
            extends down-right past it. Lives in the water layer so it
            re-tints with the rest of the pool. */}
        <path
          d="M470.966,262.312l-66.709-66.71c-12.648-13.721-30.757-22.335-50.846-22.335c-38.141,0-69.17,31.03-69.17,69.171c0,20.089,8.615,38.199,22.337,50.848l119.473,119.473c27.544-24.607,44.915-60.375,44.915-100.129v-50.318H470.966z"
          fill="url(#poolWaterDeep)"
        />
        {/* Surface ripples (the wavy lines indicating water motion) */}
        <g class="pool-icon__ripples" fill="var(--pool-water-ripple, #3FA9F5)">
          <path d="M198.31,274.119c-4.829,0-9.353-1.895-12.741-5.335c-1.873-1.903-4.366-2.948-7.025-2.948
            s-5.152,1.044-7.017,2.939c-3.392,3.447-7.918,5.342-12.747,5.342c-4.829,0-9.354-1.895-12.741-5.337
            c-1.869-1.899-4.362-2.943-7.021-2.943s-5.153,1.044-7.018,2.939c-3.39,3.445-7.915,5.34-12.744,5.34
            c-4.83,0.001-9.355-1.895-12.743-5.337c-1.867-1.897-4.361-2.941-7.02-2.941c-2.659,0-5.153,1.044-7.018,2.939
            c-3.387,3.442-7.913,5.338-12.742,5.338c-4.831,0-9.356-1.896-12.743-5.338c-1.556-1.58-1.535-4.123,0.045-5.678
            c1.582-1.555,4.124-1.536,5.678,0.045c1.866,1.896,4.359,2.94,7.019,2.94c2.659,0,5.152-1.044,7.018-2.94
            c3.387-3.442,7.913-5.337,12.742-5.337c4.829,0,9.355,1.895,12.742,5.337c1.868,1.898,4.361,2.941,7.021,2.941
            c2.659,0,5.152-1.044,7.017-2.94c3.39-3.445,7.916-5.34,12.745-5.34c0,0,0,0,0.001,0c4.829,0,9.354,1.896,12.74,5.337
            c1.869,1.899,4.363,2.944,7.021,2.944c2.659,0,5.153-1.044,7.018-2.94c3.392-3.447,7.918-5.342,12.746-5.342
            s9.353,1.895,12.741,5.335c1.873,1.903,4.366,2.948,7.025,2.948s5.152-1.043,7.017-2.939c1.557-1.58,4.099-1.599,5.679-0.044
            c1.58,1.556,1.6,4.099,0.044,5.679C207.663,272.223,203.139,274.119,198.31,274.119z" />
          <path d="M339.863,362.464c-4.829,0-9.353-1.895-12.741-5.335c-1.873-1.903-4.366-2.948-7.025-2.948
            s-5.152,1.044-7.017,2.939c-3.392,3.447-7.918,5.342-12.747,5.342s-9.354-1.895-12.741-5.337c-1.869-1.899-4.362-2.944-7.021-2.944
            c-2.659,0-5.153,1.044-7.018,2.939c-3.39,3.445-7.915,5.34-12.744,5.34c-4.83,0.001-9.355-1.895-12.743-5.337
            c-1.867-1.897-4.361-2.941-7.02-2.941c-2.659,0-5.153,1.044-7.018,2.939c-3.387,3.442-7.913,5.338-12.742,5.338
            c-4.831,0-9.356-1.896-12.743-5.338c-1.556-1.58-1.535-4.123,0.045-5.678c1.581-1.555,4.124-1.536,5.678,0.045
            c1.866,1.896,4.359,2.94,7.019,2.94c2.659,0,5.152-1.044,7.018-2.94c3.387-3.442,7.913-5.337,12.742-5.337
            c4.829,0,9.355,1.895,12.742,5.337c1.868,1.898,4.361,2.941,7.021,2.941c2.659,0,5.152-1.044,7.017-2.939
            c3.39-3.445,7.916-5.34,12.745-5.34c0,0,0,0,0.001,0c4.829,0,9.354,1.896,12.74,5.337c1.869,1.899,4.363,2.944,7.021,2.944
            c2.659,0,5.153-1.044,7.018-2.939c3.392-3.447,7.918-5.342,12.746-5.342s9.353,1.895,12.741,5.335
            c1.873,1.903,4.366,2.948,7.025,2.948s5.152-1.043,7.017-2.939c1.557-1.58,4.099-1.599,5.679-0.044
            c1.58,1.556,1.6,4.099,0.044,5.679C349.216,360.568,344.691,362.464,339.863,362.464z" />
        </g>
      </g>

      {/* === DECORATIVE LAYERS ======================================
          Pool frame, surrounding sun-burst rays, top-edge accents,
          and pool light fixture. Not chemistry-reactive. */}
      <g class="pool-icon__decor">
        {/* Gold frame ringing the pool */}
        <path
          d="M336.695,487.936c-34.075,0-67.118-9.791-95.558-28.316
            c-32.996-21.494-70.14-32.473-107.338-31.793c-0.811,0.016-1.648,0.024-2.486,0.024C58.907,427.85,0,368.943,0,296.535v-81.071
            C0,143.057,58.907,84.15,131.314,84.15c0.837,0,1.675,0.007,2.507,0.024c37.257,0.725,74.322-10.3,107.315-31.792
            c28.441-18.525,61.484-28.318,95.559-28.318C433.359,24.064,512,102.705,512,199.369V312.63
            C512,409.294,433.359,487.936,336.695,487.936z M137.114,386.763c44.099,0,87.714,13.26,126.42,38.474
            c21.759,14.173,47.058,21.666,73.162,21.666c74.038,0,134.272-60.233,134.272-134.271V199.37
            c0-74.038-60.233-134.271-134.272-134.271c-26.103,0-51.403,7.492-73.163,21.667c-39.902,25.993-85.036,39.307-130.5,38.435
            c-0.586-0.011-1.152-0.016-1.72-0.016c-49.78,0-90.28,40.5-90.28,90.281v81.071c0,49.78,40.499,90.281,90.28,90.281
            c0.567,0,1.133-0.005,1.698-0.016C134.378,386.775,135.747,386.763,137.114,386.763z"
          fill="url(#poolFrame)"
        />
        {/* Sun-burst rays — the small orange chips around the rim */}
        <g class="pool-icon__rays" fill="url(#poolDecorRays)">
          <path d="M260.016,41.693v47.325c-2.66,1.667-5.331,3.283-8.031,4.829V45.859C254.635,44.393,257.305,43.008,260.016,41.693z" />
          <path d="M260.016,422.992v47.315c-2.711-1.315-5.391-2.711-8.031-4.176v-47.967C254.685,419.71,257.365,421.326,260.016,422.992z" />
          <rect y="251.984" width="41.03" height="8.031" />
          <rect x="470.97" y="251.984" width="41.03" height="8.031" />
          <path d="M130.871,386.811l-35.92,35.92c-2.891-0.833-5.752-1.767-8.563-2.801l33.792-33.792C123.683,386.57,127.257,386.801,130.871,386.811z" />
          <path d="M451.072,66.61l-29.104,29.104c-2.088-1.707-4.216-3.363-6.405-4.959l29.274-29.274C446.956,63.137,449.034,64.853,451.072,66.61z" />
          <path d="M130.871,125.189c-3.614,0.01-7.188,0.241-10.692,0.673L86.387,92.07c2.811-1.034,5.672-1.968,8.563-2.801L130.871,125.189z" />
          <path d="M451.072,445.39c-2.038,1.757-4.116,3.474-6.234,5.13l-29.274-29.274c2.189-1.596,4.317-3.253,6.405-4.959L451.072,445.39z" />
          <path d="M201.919,396.419l-15.872,38.139c-2.61-0.733-5.23-1.405-7.861-2.008l15.952-38.33C196.739,394.903,199.339,395.635,201.919,396.419z" />
          <path d="M356.402,25.168l-16.625,39.956c-1.024-0.02-2.048-0.03-3.082-0.03c-1.897,0-3.785,0.04-5.662,0.131l16.986-40.799C350.83,24.606,353.631,24.857,356.402,25.168z" />
          <path d="M54.643,167.856c-1.436,2.289-2.761,4.638-3.965,7.058L12.72,159.112c1.155-2.429,2.389-4.819,3.694-7.158L54.643,167.856z" />
          <path d="M506.589,355.92c-0.663,2.63-1.395,5.23-2.179,7.8l-38.129-15.862c0.713-2.61,1.345-5.251,1.897-7.921L506.589,355.92z" />
          <path d="M54.252,343.522l-38.259,15.772c-1.285-2.349-2.5-4.738-3.634-7.178l37.988-15.671C51.541,338.874,52.846,341.233,54.252,343.522z" />
          <path d="M506.81,156.933l-38.48,15.862c-0.542-2.67-1.155-5.311-1.857-7.911l38.189-15.752C505.444,151.713,506.157,154.313,506.81,156.933z" />
          <path d="M202.391,115.451c-2.58,0.783-5.17,1.526-7.76,2.219l-15.812-38.34c2.62-0.612,5.24-1.285,7.841-2.028L202.391,115.451z" />
          <path d="M355.549,486.932c-2.781,0.291-5.582,0.532-8.393,0.693l-16.856-40.88c2.128,0.11,4.257,0.161,6.395,0.161c0.783,0,1.566-0.01,2.349-0.02L355.549,486.932z" />
        </g>
        {/* Yellow top-edge accents (rim highlight) */}
        <path
          d="M211.245,68.511v44.037c18.101-6.32,35.65-14.944,52.287-25.783c1.866-1.216,3.768-2.364,5.685-3.481l-29.803-29.801C230.3,59.294,220.884,64.312,211.245,68.511z"
          fill="url(#poolAccent1)"
        />
        <path
          d="M138.416,84.196v41.033c30.396-0.165,60.556-6.654,89.015-19.014V60.574C199.436,75.887,169.046,83.999,138.416,84.196z"
          fill="url(#poolAccent2)"
        />
        {/* Life-ring (right side of the pool) */}
        <path
          d="M353.412,311.61c-38.141,0-69.17-31.03-69.17-69.171s31.029-69.171,69.17-69.171s69.171,31.03,69.171,69.171S391.553,311.61,353.412,311.61z M353.412,203.385c-21.534,0-39.053,17.519-39.053,39.054c0,21.534,17.518,39.054,39.053,39.054c21.534,0,39.054-17.519,39.054-39.054S374.946,203.385,353.412,203.385z"
          fill="#E2EDF2"
        />
        <g class="pool-icon__light-blades" fill="#FF931E">
          <path d="M324.213,179.738l24.015,24.015c-8.213,1.086-16.136,4.778-22.432,11.074c-6.297,6.297-9.988,14.219-11.074,22.433l-24.015-24.015c3.308-7.142,7.908-13.829,13.793-19.713C310.384,187.646,317.072,183.046,324.213,179.738z" />
          <path d="M381.024,270.056c6.297-6.297,9.988-14.219,11.074-22.432l24.015,24.015c-3.308,7.141-7.908,13.828-13.793,19.713c-5.885,5.885-12.572,10.485-19.713,13.793l-24.015-24.015C366.806,280.044,374.728,276.353,381.024,270.056z" />
          <path d="M314.722,247.623c1.086,8.213,4.778,16.136,11.074,22.433s14.219,9.988,22.432,11.074l-24.015,24.015c-7.141-3.308-13.829-7.908-19.713-13.714c-5.885-5.885-10.485-12.572-13.793-19.714L314.722,247.623z" />
          <path d="M402.322,193.531c5.885,5.885,10.485,12.572,13.793,19.713L392.1,237.259c-1.086-8.213-4.778-16.136-11.074-22.432c-6.297-6.297-14.219-9.988-22.433-11.074l24.015-24.015C389.749,183.046,396.437,187.646,402.322,193.531z" />
        </g>
      </g>

      {/* === LADDER LAYER ===========================================
          Two vertical rails + three horizontal handles on the left
          side of the pool. All fills route through the same
          var-driven gradient so the parent can flip them to rust
          brown when the LSI bottoms out. */}
      <g class="pool-icon__ladder">
        {/* Left vertical rail */}
        <path
          d="M140.542,228.888c-7.762,0-14.055-6.293-14.055-14.055V38.162c0-7.762,6.293-14.055,14.055-14.055s14.055,6.293,14.055,14.055v176.67C154.597,222.596,148.305,228.888,140.542,228.888z"
          fill="url(#poolLadder)"
        />
        {/* Right vertical rail */}
        <path
          d="M239.355,38.164v176.67c0,7.098-5.261,12.971-12.107,13.914c-0.632,0.09-1.285,0.141-1.948,0.141c-7.76,0-14.055-6.295-14.055-14.055V38.164c0-7.76,6.295-14.055,14.055-14.055C233.07,24.109,239.355,30.404,239.355,38.164z"
          fill="url(#poolLadder)"
        />
        {/* Inner shadow / join elements */}
        <path
          d="M211.249,63.339v100.303l28.11,28.11V75.909l-7.255-7.255c-2.575-3.235-6.539-5.313-10.994-5.313h-9.861V63.339z"
          fill="url(#poolLadderJoin)"
        />
        <path
          d="M154.597,63.339h-9.861c-7.762,0-14.055,6.293-14.055,14.055c0,4.455,2.079,8.419,5.313,10.994l18.602,18.602V63.339H154.597z"
          fill="url(#poolLadderJoinSmall)"
        />
        <path
          d="M239.355,125.013v89.821c0,7.098-5.261,12.971-12.107,13.914l-16.003-16.003V112.444h9.869c4.447,0,8.413,2.078,10.993,5.311L239.355,125.013z"
          fill="url(#poolLadderJoin)"
        />
        <path
          d="M154.597,112.443h-9.861c-7.762,0-14.055,6.293-14.055,14.055c0,4.455,2.079,8.419,5.313,10.994l18.602,18.602v-43.651H154.597z"
          fill="url(#poolLadderJoinSmall)"
        />
        {/* Top horizontal rung */}
        <path
          d="M130.682,77.394c0-7.762,6.293-14.055,14.055-14.055h76.372c7.762,0,14.055,6.293,14.055,14.055s-6.293,14.055-14.055,14.055h-76.372C136.974,91.449,130.682,85.157,130.682,77.394z"
          fill="url(#poolLadder)"
        />
        {/* Middle horizontal rung */}
        <path
          d="M130.682,126.498c0-7.762,6.293-14.055,14.055-14.055h76.372c7.762,0,14.055,6.293,14.055,14.055s-6.293,14.055-14.055,14.055h-76.372C136.974,140.553,130.682,134.26,130.682,126.498z"
          fill="url(#poolLadder)"
        />
        {/* Lower-section join shadows */}
        <path
          d="M239.355,174.115v40.719c0,7.098-5.261,12.971-12.107,13.914c-0.632,0.09-1.285,0.141-1.948,0.141c-7.76,0-14.055-6.295-14.055-14.055v-53.288h9.869c4.447,0,8.413,2.078,10.993,5.311L239.355,174.115z"
          fill="url(#poolLadderJoin)"
        />
        <path
          d="M154.597,161.547h-9.861c-7.762,0-14.055,6.293-14.055,14.055c0,4.455,2.079,8.419,5.313,10.994l18.602,18.602v-43.65H154.597z"
          fill="url(#poolLadderJoinSmall)"
        />
        {/* Bottom horizontal rung */}
        <path
          d="M130.682,175.602c0-7.762,6.293-14.055,14.055-14.055h76.372c7.762,0,14.055,6.293,14.055,14.055s-6.293,14.055-14.055,14.055h-76.372C136.974,189.657,130.682,183.364,130.682,175.602z"
          fill="url(#poolLadder)"
        />
      </g>
    </svg>
  );
}
