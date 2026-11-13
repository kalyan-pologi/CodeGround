// UI-aligned content ownership. Static note files remain in the existing library
// until their loaders are migrated to feature imports.
export const featureCatalog = {
  home: {
    'getting-started': ['home', 'intro'],
    'project-writeups': ['proj-reidyai', 'proj-citibank', 'proj-accenture'],
    'project-stories': ['behavioral-stories', 'behavioral-questions']
  },
  backend: {
    'java-spring': ['java-topics', 'spring-topics', 'solid-patterns'],
    tooling: ['git-commands', 'junit-concepts', 'mongodb']
  },
  devops: {
    commands: ['devops-daily', 'devops-useful'],
    infrastructure: ['docker', 'kubernetes', 'minikube'],
    cloud: ['aws', 'azure']
  },
  web: {
    fundamentals: ['html', 'css', 'javascript', 'typescript', 'frontend-quickref'],
    frameworks: ['react', 'redux', 'angular']
  }
};

export const unchangedLibraryFeatures = ['sd', 'genai'];
