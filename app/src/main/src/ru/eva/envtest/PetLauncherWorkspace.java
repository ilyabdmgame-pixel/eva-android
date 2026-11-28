package ru.eva.envtest;

/** Only geometry on the selected external home screen is eligible for pet supports. */
final class PetLauncherWorkspace {
    private static final String ORIGINAL_HOME="com.hihonor.android.launcher";

    static boolean matches(String selected, CharSequence actual, String eva) {
        return selected!=null && actual!=null && selected.contentEquals(actual) && !selected.equals(eva);
    }
    static String entry(String resource) {
        return resource==null?"":resource.substring(resource.lastIndexOf('/')+1);
    }
    static int workspaceRank(String id, String type) {
        String name=entry(id);
        if(name.equals("workspace"))return 3;
        if(name.equals("workspace_pager")||name.equals("workspace_view")||name.equals("home_workspace"))return 2;
        return type!=null&&type.endsWith(".Workspace")?1:0;
    }
    static int support(String id, String type) {
        String name=entry(id);
        if(name.equals("preview_background")||name.equals("card_folder_workspace_layout")||name.equals("folder_icon")||
                (type!=null&&type.endsWith(".FolderIcon")))return PetHomeMap.FOLDER;
        if(name.equals("card_stack_view")||(type!=null&&type.endsWith("AppWidgetHostView")))return PetHomeMap.WIDGET;
        return 0;
    }
    static String layoutKey(String launcher,int rotation) {
        if(launcher==null)return null;
        if(launcher.equals(ORIGINAL_HOME))return rotation==0?"honor_home":"honor_home_rotation_"+rotation;
        return "home:"+launcher+":"+rotation;
    }
    static String manualKey(String launcher,int rotation,int page) {
        String legacy=PetLearnedEdges.key(rotation,page);
        if(launcher==null||legacy==null)return null;
        return launcher.equals(ORIGINAL_HOME)?legacy:"home:"+launcher+":"+legacy;
    }
}
