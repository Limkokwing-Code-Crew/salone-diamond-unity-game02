# Unity Score Bridge Setup (BUILD04)

This repository contains the WebGL build output, not Unity C# source files.
Use the snippets below in your Unity project, then rebuild WebGL into `BUILD04/Build`.

## 1) Add a WebGL plugin (`Assets/Plugins/WebGL/ScoreBridge.jslib`)

```javascript
mergeInto(LibraryManager.library, {
  SendScoreToJS: function (score) {
    if (typeof window !== "undefined" && typeof window.onUnityScoreUpdate === "function") {
      window.onUnityScoreUpdate(score);
    }
  }
});
```

## 2) Call it from your C# game-over flow

```csharp
using System.Runtime.InteropServices;
using UnityEngine;

public class ScoreBridge : MonoBehaviour
{
    #if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void SendScoreToJS(int score);
    #endif

    public void ReportFinalScore(int finalScore)
    {
        #if UNITY_WEBGL && !UNITY_EDITOR
        SendScoreToJS(finalScore);
        #endif
    }
}
```

Call `ReportFinalScore(...)` once when the run ends.

## 3) Web page side (already done in `BUILD04/index.html`)

The page already supports:
- `window.onUnityScoreUpdate(score)` (primary callback)
- `window.onGameOverScore(score)` and `window.receiveUnityScore(score)` (alternates)
- `window.submitScore(score)` (direct Unity call)
- `window.askUnityForScore(gameObjectName, methodName)` (pull mode helper)

## 4) Verify in browser console

1. Log in.
2. End a round.
3. Confirm console logs: `Unity submitted score: ...`
4. Run:

```javascript
await verifyScorePipeline(42)
```

If this works but game-over does not submit, Unity is not invoking the bridge method.
