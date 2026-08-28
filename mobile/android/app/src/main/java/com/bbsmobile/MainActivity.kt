package com.bbsmobile

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

    /**
     * Retourne le nom du composant principal enregistré dans JavaScript.
     * Doit correspondre au nom utilisé dans AppRegistry.registerComponent() dans index.js
     */
    override fun getMainComponentName(): String = "BBSMobile"

    /**
     * Retourne l'instance de ReactActivityDelegate.
     * Utilise DefaultReactActivityDelegate qui permet d'activer
     * la nouvelle architecture React Native.
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
